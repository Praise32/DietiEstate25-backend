import type { NextFunction, Request, Response } from "express";

import jwt from "jsonwebtoken";

import { postIdSchema } from "@/db/schema/posts";
import env from "@/env";
import * as agenciesRepository from "@/repository/agencies.repository";
import * as postsRepository from "@/repository/posts.repository";
import * as userRepository from "@/repository/user.repository";
import { sendBadRequestResponse, sendForbiddenResponse, sendNotFoundResponse, sendUnauthorizedResponse } from "@/utils";

interface TokenPayload {
  id: number;
  name?: string;
  email?: string;
  role?: string;
}

function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

async function verifyAndDecodeToken(token: string): Promise<TokenPayload | null> {
  return new Promise((resolve) => {
    jwt.verify(token, env.JWT_SECRET_KEY, (err, decoded) => {
      if (err) {
        resolve(null);
      }
      else {
        resolve(decoded as TokenPayload);
      }
    });
  });
}

async function enrichUserFromDatabase(decodedToken: TokenPayload) {
  const userFound = await userRepository.getUserById(decodedToken.id);
  if (!userFound) {
    return null;
  }

  return {
    ...userFound,
    role: userFound.role ?? null,
  };
}

function createUserFromToken(decodedToken: TokenPayload): Express.User {
  return {
    id: decodedToken.id,
    name: decodedToken.name || null,
    email: decodedToken.email || null,
    role: decodedToken.role || null,
    phone: "",
    password: "",
    roleId: 0,
    agencyId: null,
    hasCreatedAgency: false,
    createdAt: "",
    updatedAt: "",
  };
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.get("authorization");
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    sendUnauthorizedResponse(res, "Accesso negato. Nessun token fornito o formato non valido.");
    return;
  }

  const decodedToken = await verifyAndDecodeToken(token);

  if (!decodedToken || !decodedToken.id) {
    sendUnauthorizedResponse(res, "Accesso negato. Token non valido.");
    return;
  }

  if (decodedToken.role) {
    req.user = createUserFromToken(decodedToken);
    next();
    return;
  }

  const userFromDb = await enrichUserFromDatabase(decodedToken);
  if (!userFromDb) {
    sendUnauthorizedResponse(res, "Utente non trovato.");
    return;
  }

  req.user = userFromDb;
  next();
}

function hasAdminOrSupportRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "support";
}

function isPostOwner(userId: number | undefined, postUserId: number): boolean {
  return userId === postUserId;
}

async function isManagerOfPostAgency(userId: number, postAgencyId: number): Promise<boolean> {
  const managerAgency = await agenciesRepository.getAgencyByManagerId(userId);
  return !!(managerAgency && managerAgency.id === postAgencyId);
}

async function canUserModifyPost(
  currentUser: Express.User,
  post: { userId: number; agencyId: number | null },
): Promise<boolean> {
  if (hasAdminOrSupportRole(currentUser.role)) {
    return true;
  }

  if (isPostOwner(currentUser.id, post.userId)) {
    return true;
  }

  if (currentUser.role === "manager" && post.agencyId !== null && currentUser.id) {
    return isManagerOfPostAgency(currentUser.id, post.agencyId);
  }

  return false;
}

export async function isOwnerMiddlewarePosts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const validation = postIdSchema.safeParse(req.params);
  if (!validation.success || !validation.data) {
    sendBadRequestResponse(res, validation.error);
    return;
  }

  const foundPost = await postsRepository.getPostById(validation.data.id);
  if (!foundPost) {
    sendNotFoundResponse(res);
    return;
  }

  const currentUser = req.user;
  if (!currentUser) {
    sendUnauthorizedResponse(res);
    return;
  }

  const isAuthorized = await canUserModifyPost(currentUser, foundPost);

  if (!isAuthorized) {
    sendForbiddenResponse(res, "Non sei autorizzato a modificare questo post");
    return;
  }

  req.posts = foundPost;
  next();
}
