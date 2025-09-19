import type { NextFunction, Request, Response } from "express";

import jwt from "jsonwebtoken";

import { postIdSchema } from "@/db/schema/posts";
import env from "@/env";
import * as postsRepository from "@/repository/posts.repository";
import * as userRepository from "@/repository/user.repository";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ message: "Accesso negato. Nessun token fornito o formato non valido." });
    return;
  }

  const token = authHeader.substring(7); // Rimuove "Bearer " dalla stringa del token
  jwt.verify(token, env.JWT_SECRET_KEY, async (err, decoded) => {
    if (err) {
      res.status(401).json({ message: "Accesso negato. Nessun token fornito o formato non valido." });
      return;
    }

    const userId = (<{ id: number }>decoded).id;
    if (!userId) {
      res.status(401).json({ message: "Accesso negato. Nessun token fornito o formato non valido." });
      return;
    }
    const userFound = await userRepository.getUserById(userId);
    if (!userFound) {
      res
        .status(401)
        .json({ message: "Accesso negato. Nessun token fornito o formato non valido." });
      return;
    }
    const userWithFixedRole = {
      ...userFound,
      role: userFound.role ?? undefined
    };
    req.user = userWithFixedRole;

    // Passa al middleware successivo
    next();
  });
}

// Middleware per verificare che l'utente sia il proprietario del post
export async function isOwnerMiddlewarePosts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const updatePost = postIdSchema.safeParse(req.params);
  if (updatePost.error || !updatePost.data) {
    res.status(400).json(updatePost.error).end();
    return;
  }
  const foundPost = await postsRepository.getPostById(updatePost.data.id);
  if (!foundPost) {
    res.status(404).end();
    return;
  }

  if (foundPost.userId !== req.user!.id) {
    res.status(403).json("Non sei autorizzato a modificare il post middleware").end();
    return;
  }

  req.posts = foundPost;

  next();
}

