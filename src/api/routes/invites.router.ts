import bcrypt from "bcryptjs";
import express from "express";
import validate from "express-zod-safe";
import jwt from "jsonwebtoken";

import { inviteSchema } from "@/db/schema/invites";
import env from "@/env";
import * as agenciesRepository from "@/repository/agencies.repository";
import * as inviteRepository from "@/repository/invites.repository";
import * as userRepository from "@/repository/user.repository";
import { sendInviteEmail } from "@/utils/email";

import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = express.Router();

// Helper: Verifica se l'utente ha i permessi per invitare un certo ruolo
function checkAuthorization(userRole: string, targetRole: string): boolean {
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

// Helper estratto: Logica per invitare un MANAGER
async function resolveManagerInvite(
  userRole: string,
  requestedAgencyId?: number,
): Promise<{ finalAgencyId: number | null; error?: { status: number; message: string } }> {
  // Solo Admin e Support possono invitare manager
  if (userRole !== "admin" && userRole !== "support") {
    return { finalAgencyId: null, error: { status: 403, message: "Solo Admin e Support possono invitare manager." } };
  }

  // Se non viene specificata un'agenzia, è un invito generico
  if (!requestedAgencyId) {
    return { finalAgencyId: null };
  }

  // Se viene specificata un'agenzia, controlliamo esistenza e conflitti
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

// Helper estratto: Logica per invitare un AGENTE
async function resolveAgentInvite(
  userRole: string,
  userId: number,
  requestedAgencyId?: number,
): Promise<{ finalAgencyId: number | null; error?: { status: number; message: string } }> {
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

// Helper principale: Ora agisce solo come dispatcher
async function resolveAgencyId(
  userRole: string,
  userId: number,
  targetRole: string,
  requestedAgencyId?: number,
): Promise<{ finalAgencyId: number | null; error?: { status: number; message: string } }> {
  if (targetRole === "manager") {
    return resolveManagerInvite(userRole, requestedAgencyId);
  }

  if (targetRole === "agent") {
    return resolveAgentInvite(userRole, userId, requestedAgencyId);
  }

  return { finalAgencyId: null };
}
// Route per creare un invito
router.post(
  "/create",
  authMiddleware,
  requireRole("support", "manager", "admin"),
  validate({ body: inviteSchema }),
  async (req, res) => {
    if (!req.user?.id) {
      res.status(401).json({ message: "Utente non autenticato o ID utente non trovato." });
      return;
    }
    const { email, role, agencyId } = req.body;

    if (!req.user.role) {
      res.status(403).json({ message: "Ruolo utente non disponibile." });
      return;
    }

    // 1. Verifica autorizzazioni
    if (!checkAuthorization(req.user.role, role)) {
      res.status(403).json({
        message: `Non autorizzato a creare inviti per il ruolo '${role}'`,
      });
      return;
    }

    // 2. Risolvi agencyId (gestione speciale per agenti)
    const { finalAgencyId, error } = await resolveAgencyId(req.user.role, req.user.id, role, agencyId);

    if (error) {
      res.status(error.status).json({ message: error.message });
      return;
    }

    const token = jwt.sign(
      { email, role, agencyId: finalAgencyId },
      env.JWT_SECRET_KEY,
      { expiresIn: "24h" },
    );

    try {
      // Crea l'invito nel database
      await inviteRepository.createInvite({
        email,
        role,
        token,
        invitedBy: req.user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Invia l'email di invito
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
  },
);

// Nuova route per ottenere tutte le agenzie disponibili (per admin e support)
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

    const decoded = jwt.verify(token, env.JWT_SECRET_KEY) as {
      email: string;
      role: string;
    };

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

  // Decodifica il token per ottenere l'agencyId se presente
  let agencyId = null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_KEY) as {
      agencyId?: number | null;
    };
    agencyId = decoded.agencyId || null;
  }
  catch (error) {
    console.error("Errore nella decodifica del token:", error);
  }

  // Se è un manager con un'agenzia assegnata, imposta hasCreatedAgency a true
  const isManagerWithAgency = invite.role === "manager" && agencyId !== null;

  // Crea nuovo utente
  const user = await userRepository.createUser({
    email: invite.email,
    password: bcrypt.hashSync(password, 10),
    name,
    phone,
    roleId,
    agencyId,
    hasCreatedAgency: isManagerWithAgency,
  });

  // Se è un manager con agenzia, aggiorna l'agenzia con il nuovo managerId
  if (isManagerWithAgency && user?.id) {
    await agenciesRepository.updateAgency(agencyId, { managerId: user.id });
  }

  await inviteRepository.markInviteAsUsed(token);

  // Genera JWT per il nuovo utente
  const authToken = jwt.sign(
    {
      id: user?.id,
      name: user?.name,
      email: user?.email,
      role: user?.role,
    },
    env.JWT_SECRET_KEY,
    { expiresIn: "24h" },
  );

  res.json({
    message: "Registrazione completata con successo",
    token: authToken,
  });
});

export default router;
