import bcrypt from "bcryptjs";
import express from "express";
import validate from "express-zod-safe";
import jwt from "jsonwebtoken";
import { inviteSchema } from "../../db/schema/invites.js";
import env from "../../env.js";
import * as agenciesRepository from "../../repository/agencies.repository.js";
import * as inviteRepository from "../../repository/invites.repository.js";
import * as userRepository from "../../repository/user.repository.js";
import { sendInviteEmail } from "../../utils/email.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
const router = express.Router();
function checkAuthorization(userRole, targetRole) {
    switch (userRole) {
        case "admin":
            return ["admin", "support", "manager", "agent", "customer"].includes(targetRole);
        case "support":
            return ["manager", "agent", "customer"].includes(targetRole);
        case "manager":
            return targetRole === "agent";
        default:
            return false;
    }
}
async function resolveManagerInvite(userRole, requestedAgencyId) {
    if (userRole !== "admin" && userRole !== "support") {
        return { finalAgencyId: null, error: { status: 403, message: "Solo Admin e Support possono invitare manager." } };
    }
    if (!requestedAgencyId) {
        return { finalAgencyId: null };
    }
    const agency = await agenciesRepository.getAgencyById(requestedAgencyId);
    if (!agency) {
        return { finalAgencyId: null, error: { status: 404, message: "L'agenzia specificata non esiste." } };
    }
    if (agency.managerId !== null) {
        return {
            finalAgencyId: null,
            error: {
                status: 409,
                message: `L'agenzia '${agency.name}' ha già un manager assegnato. Rimuoverlo prima di invitarne uno nuovo.`,
            },
        };
    }
    return { finalAgencyId: requestedAgencyId };
}
async function resolveAgentInvite(userRole, userId, requestedAgencyId) {
    if (userRole === "manager") {
        const managerAgency = await agenciesRepository.getAgencyByManagerId(userId);
        if (!managerAgency) {
            return { finalAgencyId: null, error: { status: 403, message: "Devi prima creare un'agenzia prima di invitare agenti" } };
        }
        return { finalAgencyId: managerAgency.id };
    }
    if (userRole === "admin" || userRole === "support") {
        if (!requestedAgencyId) {
            return { finalAgencyId: null, error: { status: 400, message: "È necessario specificare un'agenzia quando si invita un agente" } };
        }
        const agency = await agenciesRepository.getAgencyById(requestedAgencyId);
        if (!agency) {
            return { finalAgencyId: null, error: { status: 404, message: "L'agenzia specificata non esiste" } };
        }
        return { finalAgencyId: requestedAgencyId };
    }
    return { finalAgencyId: null };
}
async function resolveAgencyId(userRole, userId, targetRole, requestedAgencyId) {
    if (targetRole === "manager") {
        return resolveManagerInvite(userRole, requestedAgencyId);
    }
    if (targetRole === "agent") {
        return resolveAgentInvite(userRole, userId, requestedAgencyId);
    }
    return { finalAgencyId: null };
}
router.post("/create", authMiddleware, requireRole("support", "manager", "admin"), validate({ body: inviteSchema }), async (req, res) => {
    if (!req.user?.id) {
        res.status(401).json({ message: "Utente non autenticato o ID utente non trovato." });
        return;
    }
    const { email, role, agencyId } = req.body;
    if (!req.user.role) {
        res.status(403).json({ message: "Ruolo utente non disponibile." });
        return;
    }
    if (!checkAuthorization(req.user.role, role)) {
        res.status(403).json({
            message: `Non autorizzato a creare inviti per il ruolo '${role}'`,
        });
        return;
    }
    const { finalAgencyId, error } = await resolveAgencyId(req.user.role, req.user.id, role, agencyId);
    if (error) {
        res.status(error.status).json({ message: error.message });
        return;
    }
    const token = jwt.sign({ email, role, agencyId: finalAgencyId }, env.JWT_SECRET_KEY, { expiresIn: "24h" });
    try {
        await inviteRepository.createInvite({
            email,
            role,
            token,
            invitedBy: req.user.id,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
        await sendInviteEmail(email, token);
        res.status(201).json({
            message: "Invito creato e inviato con successo",
            registrationLink: `${env.FRONTEND_URL}/register/invite/${token}`,
            messageBack: "Invito creato con successo (Prova BackEnd)",
            registrationLinkBack: `http://localhost:5003/invite/register/${token}`,
        });
    }
    catch (error) {
        console.error("Errore durante la creazione o l'invio dell'invito:", error);
        res.status(500).json({ message: "Si è verificato un errore durante l'invio dell'invito.", error });
    }
});
router.get("/agencies", authMiddleware, requireRole("admin", "support"), async (_req, res) => {
    try {
        const agencies = await agenciesRepository.getAllAgencies();
        const agenciesForSelection = agencies.map(agency => ({
            id: agency.id,
            name: agency.name,
            city: agency.city,
            address: agency.address,
        }));
        res.status(200).json(agenciesForSelection);
    }
    catch (error) {
        console.error("Errore durante il recupero delle agenzie:", error);
        res.status(500).json({ message: "Errore durante il recupero delle agenzie" });
    }
});
router.get("/validate/:token", async (req, res) => {
    const { token } = req.params;
    try {
        const invite = await inviteRepository.getInviteByToken(token);
        if (!invite || invite.used || new Date(invite.expiresAt) < new Date()) {
            res.status(400).json({
                valid: false,
                message: "Invito non valido o scaduto",
            });
            return;
        }
        const decoded = jwt.verify(token, env.JWT_SECRET_KEY);
        res.json({
            valid: true,
            email: decoded.email,
            role: decoded.role,
        });
    }
    catch (error) {
        console.error("Errore nella validazione del token:", error);
        res.status(400).json({
            valid: false,
            message: "Token non valido",
        });
    }
});
router.post("/register/:token", async (req, res) => {
    const { token } = req.params;
    const { password, name, phone } = req.body;
    const invite = await inviteRepository.getInviteByToken(token);
    if (!invite || invite.used || new Date(invite.expiresAt) < new Date()) {
        res.status(400).json({ message: "Invito non valido o scaduto" });
        return;
    }
    const roleId = await userRepository.getRoleId(invite.role);
    if (roleId === null) {
        res.status(400).json({ message: `Il ruolo '${invite.role}' non è valido.` });
        return;
    }
    let agencyId = null;
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET_KEY);
        agencyId = decoded.agencyId || null;
    }
    catch (error) {
        console.error("Errore nella decodifica del token:", error);
    }
    const user = await userRepository.createUser({
        email: invite.email,
        password: bcrypt.hashSync(password, 10),
        name,
        phone,
        roleId,
        agencyId,
    });
    await inviteRepository.markInviteAsUsed(token);
    const authToken = jwt.sign({
        id: user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
    }, env.JWT_SECRET_KEY, { expiresIn: "24h" });
    res.json({
        message: "Registrazione completata con successo",
        token: authToken,
    });
});
export default router;
