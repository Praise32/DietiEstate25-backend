import bcrypt from "bcryptjs";
import express from "express";
import validate from "express-zod-safe";
import { z } from "zod";
import * as userRepository from "../../repository/user.repository.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
const router = express.Router();
const changePasswordSchema = z.object({
    oldPassword: z.string().nonempty(),
    newPassword: z.string().min(8),
});
router.post("/change-password", authMiddleware, requireRole("admin"), validate({ body: changePasswordSchema }), async (req, res) => {
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
});
export default router;
