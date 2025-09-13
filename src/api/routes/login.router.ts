import bcrypt from "bcryptjs";
import express from "express";
import validate from "express-zod-safe";
import jwt from "jsonwebtoken";
import { db } from "@/db";
import { roles } from "@/db/schema/user";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { z } from "zod";

import {
  userInserSchema,
  userLoginSchema,
  userSelectSchema,
} from "@/db/schema/user";
import env from "@/env";
import * as loginRepositoy from "@/repository/login.repository";
import passport from "@/utils/passport";

const router = express.Router();

router.post(
  "/register",
  validate({ body: userInserSchema }),
  async (req, res) => {
    try {
      req.body.password = bcrypt.hashSync(req.body.password, 8);


      const [customerRole] = await db.select().from(roles).where(eq(roles.name, "customer"));
      req.body.roleId = customerRole.id;

      const idUser = await loginRepositoy.createUser(req.body);
      const token = jwt.sign(
        {
          id: idUser.id,
          name: idUser.name,
          email: idUser.email,
        },
        env.JWT_SECRET_KEY,
        { expiresIn: "24h" },
      );

      if (token.length === 0) {
        res.status(503).end();
        return;
      }

      res.json({ token });
    }
    catch (error: any) {
      // Gestione errore unique constraint (Postgres/Drizzle)
      if (
        error.code === "23505" // Postgres unique_violation
        || (error.message && error.message.includes("unique"))
      ) {
        // Cerca il campo che ha causato il conflitto nel messaggio di errore
        let field = "campo";
        const detail = error.detail || error.message;
        // Esempio di detail: 'Key (email)=(test@example.com) already exists.'
        const match = detail && detail.match(/\(([^)]+)\)=/);
        if (match && match[1]) {
          field = match[1];
        }
        res
          .status(409)
          .json({ message: `Il campo '${field}' è già stato usato.` });
        return;
      }
      // Altri errori
      res.status(500).json({ message: "Errore interno del server." });
    }
  },
);


// Route per iniziare l'autenticazione Google
router.get(
  '/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

// Route di callback per Google
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: '/login' 
  }),
  async (req, res) => {
    const token = jwt.sign(
      {
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email,
      },
      env.JWT_SECRET_KEY,
      { expiresIn: "24h" }
    );

    // Redirect al frontend con il token
    //res.redirect(`${env.FRONTEND_URL}/auth?token=${token}`);

    //Prova senza frontend
        res.json({ 
      message: "Autenticazione Google riuscita",
      token,
      user: {
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email
      }
    });

  }
);

router.post(
  "/",
  validate({ body: userLoginSchema }),
  passport.authenticate("local", { session: false }),
  async (req, res) => {
    const token = jwt.sign(
      {
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email,
      },
      env.JWT_SECRET_KEY,
      { expiresIn: "24h" },
    );

    if (token.length === 0) {
      res.status(503).end();
      return;
    }

    res.json({ token });
  },
);

export default router;
