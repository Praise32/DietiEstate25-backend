import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import express from "express";
import validate from "express-zod-safe";
import jwt from "jsonwebtoken";

import { db } from "@/db";
import { roles, userInserSchema, userLoginSchema } from "@/db/schema/user";
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
          role: "customer",
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
    catch (error) {
      if (
        error instanceof Error
        && (
          (error as { code?: string }).code === "23505"
          || error.message?.includes("unique")
        )
      ) {
        let field = "campo";
        const detail = (error as { detail?: string }).detail || error.message;
        const match = detail?.match(/\(([^)]{1,100})\)=/);
        if (match?.[1]) {
          field = match[1];
        }
        res
          .status(409)
          .json({ message: `Il campo '${field}' è già stato usato.` });
        return;
      }
      res.status(500).json({ message: "Errore interno del server." });
    }
  },
);

// Route per iniziare l'autenticazione Google
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

// Route di callback per Google
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  async (req, res) => {
    const user = req.user;
    if (!user?.id || !user?.name || !user?.email || !user?.role) {
      res.status(401).json({ message: "Autenticazione fallita" });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET_KEY,
      { expiresIn: "24h" },
    );

    res.redirect(`${env.FRONTEND_URL}/auth/google/callback?token=${token}`);
  },
);

router.post(
  "/",
  validate({ body: userLoginSchema }),
  passport.authenticate("local", { session: false }),
  async (req, res) => {
    const user = req.user;
    if (!user?.id || !user?.name || !user?.email || !user?.role) {
      res.status(401).json({ message: "Autenticazione fallita" });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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
