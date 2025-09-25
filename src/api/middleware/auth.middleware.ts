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

  const token = authHeader.substring(7);
  jwt.verify(token, env.JWT_SECRET_KEY, async (err, decoded) => {
    if (err) {
      res.status(401).json({ message: "Accesso negato. Token non valido." });
      return;
    }

    const decodedToken = decoded as {
      id: number;
      name?: string;
      email?: string;
      role?: string;
    };

    if (!decodedToken.id) {
      res.status(401).json({ message: "Accesso negato. Token non valido." });
      return;
    }

    // Se il ruolo è presente nel token, usalo direttamente (più efficiente)
    if (decodedToken.role) {
      req.user = {
        id: decodedToken.id,
        name: decodedToken.name || null,
        email: decodedToken.email || null,
        role: decodedToken.role,
        // Aggiungi altri campi richiesti da UserSelectSchema se necessari
        phone: "",
        password: "",
        roleId: 0, // Questi non sono usati quando il ruolo è nel token
        agencyId: null,
        hasCreatedAgency: false,
        createdAt: "",
        updatedAt: "",
      };
      next();
      return;
    }

    // Fallback: se il ruolo non è nel token, recupera dal database
    const userFound = await userRepository.getUserById(decodedToken.id);
    if (!userFound) {
      res.status(401).json({ message: "Utente non trovato." });
      return;
    }

    req.user = {
      ...userFound,
      role: userFound.role ?? undefined,
    };

    next();
  });
}

// ...existing code...

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
