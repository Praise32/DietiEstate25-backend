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

// Route per creare un invito
router.post(
  "/create",
  authMiddleware,
  requireRole("support", "manager", "admin"),
  validate({ body: inviteSchema }),
  async (req, res) => {
    if (!req.user || !req.user.id) {
      res.status(401).json({ message: "Utente non autenticato o ID utente non trovato." });
      return;
    }
    const { email, role, agencyId } = req.body;

    // Nuova logica per i permessi basati sui requisiti
    let isAuthorized = false;

    switch (req.user.role) {
      case "admin":
        // Admin può invitare tutti i ruoli
        isAuthorized = ["admin", "support", "manager", "agent", "customer"].includes(role);
        break;

      case "support":
        // Support può invitare tutti tranne se stesso
        isAuthorized = ["manager", "agent", "customer"].includes(role);
        break;

      case "manager":
        // Manager può invitare solo agent
        isAuthorized = role === "agent";
        break;

      case "agent":
        // Agent non può invitare nessuno (già escluso dal requireRole)
        isAuthorized = false;
        break;

      default:
        isAuthorized = false;
    }

    if (!isAuthorized) {
      res.status(403).json({
        message: `Non autorizzato a creare inviti per il ruolo '${role}'`,
      });
      return;
    }

    // Gestione speciale per gli agenti
    let finalAgencyId = null;

    if (role === "agent") {
      if (req.user.role === "manager") {
        // Manager può invitare agenti solo nella sua agenzia
        const managerAgency = await agenciesRepository.getAgencyByManagerId(req.user.id);
        if (!managerAgency) {
          res.status(403).json({ message: "Devi prima creare un'agenzia prima di invitare agenti" });
          return;
        }
        finalAgencyId = managerAgency.id;
      }
      else if (req.user.role === "admin" || req.user.role === "support") {
        // Admin e Support devono specificare un'agenzia quando invitano agenti
        if (!agencyId) {
          res.status(400).json({ message: "È necessario specificare un'agenzia quando si invita un agente" });
          return;
        }

        // Verifica che esistano agenzie nel sistema
        const allAgencies = await agenciesRepository.getAllAgencies();
        if (allAgencies.length === 0) {
          res.status(400).json({ message: "Impossibile invitare agenti: non esistono agenzie nel sistema. Creare prima un'agenzia." });
          return;
        }

        // Verifica che l'agenzia specificata esista
        const agency = await agenciesRepository.getAgencyById(agencyId);
        if (!agency) {
          res.status(404).json({ message: "L'agenzia specificata non esiste" });
          return;
        }

        finalAgencyId = agencyId;
      }
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
router.get("/agencies", authMiddleware, requireRole("admin", "support"), async (req, res) => {
  try {
    const agencies = await agenciesRepository.getAllAgencies();

    // Restituisci solo le informazioni necessarie per la selezione
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
    // Verifica se l'invito esiste nel database
    const invite = await inviteRepository.getInviteByToken(token);

    if (!invite || invite.used || new Date(invite.expiresAt) < new Date()) {
      res.status(400).json({
        valid: false,
        message: "Invito non valido o scaduto",
      });
      return;
    }

    // Decodifica il token per ottenere le informazioni
    const decoded = jwt.verify(token, env.JWT_SECRET_KEY) as any;

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

// Route per la registrazione tramite invito
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
    const decoded = jwt.verify(token, env.JWT_SECRET_KEY) as any;
    agencyId = decoded.agencyId || null;
  }
  catch (error) {
    console.error("Errore nella decodifica del token:", error);
  }

  // Crea nuovo utente
  const user = await userRepository.createUser({
    email: invite.email,
    password: bcrypt.hashSync(password, 10),
    name,
    phone,
    roleId,
    agencyId,
  });

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
