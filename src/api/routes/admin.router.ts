import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import express from "express";
import validate from "express-zod-safe";
import { z } from "zod";

import { db } from "@/db";
import { roles, userInserSchema } from "@/db/schema/user";
import * as userRepository from "@/repository/user.repository";

import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = express.Router();

// Admin crea un nuovo utente di supporto o manager
router.post(
  "/create",
  authMiddleware,
  requireRole("admin"),
  validate({ body: userInserSchema.extend({ role: z.string().nonempty() }) }),
  async (req, res) => {
    try {
      const { password, role, ...rest } = req.body;
      const hashedPassword = bcrypt.hashSync(password, 10);

      // Recupera l'id del ruolo richiesto
      const [roleRow] = await db.select().from(roles).where(eq(roles.name, role));
      if (!roleRow) {
        res.status(400).json({ message: "Ruolo non valido." });
        return;
      }

      if (!rest.name || !rest.email || !rest.phone) {
        res.status(400).json({ message: "Tutti i campi obbligatori devono essere compilati." });
        return;
      }
      const user = await userRepository.createUser({
        name: rest.name,
        email: rest.email,
        phone: rest.phone,
        password: hashedPassword,
        roleId: roleRow.id,
      });

      res.status(201).json({ message: "Utente creato", user });
    }
    catch (error) {
      res.status(500).json({ message: "Errore interno", error });
    }
  },
);

// Admin vede tutti gli utenti (opzionale)
router.get(
  "/",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const users = await userRepository.getAllUsersWithRoles?.();
    res.json(users);
  },
);

const changePasswordSchema = z.object({
  oldPassword: z.string().nonempty(),
  newPassword: z.string().min(8),
});

router.post(
  "/change-password",
  authMiddleware,
  requireRole("admin"),
  validate({ body: changePasswordSchema }), // Aggiungiamo la validazione usando express-zod-safe
  async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!req.user?.id) {
      res.status(401).json({ message: "Utente non autenticato o id mancante" });
      return;
    }

    const admin = await userRepository.getUserById(req.user.id);
    if (!admin) {
      res.status(401).json({ message: "Admin non trovato!" });
      return;
    }

    const match = bcrypt.compareSync(oldPassword, admin.password);
    if (!match) {
      res.status(401).json({ message: "Vecchia password errata" });
      return;
    }

    if (oldPassword === newPassword) {
      res.status(400).json({ message: "La nuova password deve essere diversa dalla vecchia" });
      return;
    }

    const hashed = bcrypt.hashSync(newPassword, 10);
    await userRepository.updatePassword(admin.id, hashed);

    res.status(200).json({ message: "Password aggiornata con successo" });
  },
);

export default router;
