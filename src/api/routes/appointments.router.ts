import type { Request, Response } from "express";

import express from "express";
import validate from "express-zod-safe";

import { authMiddleware } from "@/api/middleware/auth.middleware";
import { requireRole } from "@/api/middleware/role.middleware";
import {
  appointmentApiSchema,
  appointmentIdSchema,
  appointmentStatusUpdateSchema,
} from "@/db/schema/appointments";
import * as agenciesRepository from "@/repository/agencies.repository";
import * as appointmentsRepository from "@/repository/appointments.repository";
import * as postsRepository from "@/repository/posts.repository";
import * as userRepository from "@/repository/user.repository";
import { sendAppointmentConfirmationEmail, sendAppointmentNotificationEmail, sendAppointmentRejectionEmail } from "@/utils/email";
import passport from "@/utils/passport";

const router = express.Router();

// Richiesta di una nuova visita
router.post("/", authMiddleware, validate({ body: appointmentApiSchema }), async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Utente non autenticato" });
      return;
    }

    // Verifica che l'immobile esista
    const post = await postsRepository.getPostById(req.body.postId);
    if (!post) {
      res.status(404).json({ message: "Immobile non trovato" });
      return;
    }

    // Verifica che l'agente esista
    const agent = await userRepository.getUserById(post.userId);
    if (!agent) {
      res.status(404).json({ message: "Agente non trovato" });
      return;
    }

    // Crea l'appuntamento
    const appointment = await appointmentsRepository.createAppointment({
      ...req.body,
      userId: req.user.id,
      agentId: post.userId,
    });

    // Invia email di notifica all'agente
    await sendAppointmentNotificationEmail(
      agent.email ?? undefined,
      req.user.name || "Cliente",
      post.title,
      new Date(req.body.requestedDate),
      appointment.id,
    );

    res.status(201).json({
      message: "Richiesta di visita inviata con successo",
      appointment,
    });
  }
  catch (error) {
    console.error("Errore durante la creazione dell'appuntamento:", error);
    res.status(500).json({ message: "Errore durante la richiesta di visita" });
  }
});

// Ottieni appuntamenti (differenziati per ruolo)
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Utente non autenticato" });
      return;
    }

    let appointments: any[];

    switch (req.user.role) {
      case "admin":
      case "support":
        // Admin e Support vedono tutti gli appuntamenti del sistema con dati agente completi
        appointments = await appointmentsRepository.getAllAppointments();
        break;

      case "manager": {
        // Manager vede tutti gli appuntamenti della sua agenzia con dati agente completi
        const managerAgency = await agenciesRepository.getAgencyByManagerId(req.user.id);
        if (managerAgency) {
          appointments = await appointmentsRepository.getAppointmentsByAgencyId(managerAgency.id);
        }
        else {
          appointments = [];
        }
        break;
      }

      case "agent":
        // Agente vede solo i suoi appuntamenti
        appointments = await appointmentsRepository.getAppointmentsByAgentId(req.user.id);
        break;

      default:
        // Cliente vede solo i suoi appuntamenti
        appointments = await appointmentsRepository.getAppointmentsByUserId(req.user.id);
        break;
    }

    res.status(200).json(appointments);
  }
  catch (error) {
    console.error("Errore durante il recupero degli appuntamenti:", error);
    res.status(500).json({ message: "Errore durante il recupero degli appuntamenti" });
  }
});

router.put("/:id", passport.authenticate("jwt", { session: false }), requireRole("agent", "admin", "manager", "support"), async (req: Request, res: Response) => {
  try {
    const putID = appointmentIdSchema.safeParse(req.params);
    if (putID.error || !putID.data) {
      res.status(400).json(putID.error);
      return;
    }

    const putBody = appointmentStatusUpdateSchema.safeParse(req.body);
    if (putBody.error || !putBody.data) {
      res.status(400).json(putBody.error);
      return;
    }

    const { status, notes } = req.body;

    // Verifica che l'appuntamento esista
    const appointment = await appointmentsRepository.getAppointmentById(putID.data.id);
    if (!appointment) {
      res.status(404).json({ message: "Appuntamento non trovato" });
      return;
    }

    // Controllo autorizzazioni in base al ruolo
    let isAuthorized = false;

    if (req.user!.role === "admin" || req.user!.role === "support") {
      // Admin e Support possono modificare tutti gli appuntamenti
      isAuthorized = true;
    }
    else if (req.user!.role === "manager") {
      // Manager può modificare appuntamenti della sua agenzia
      const agent = await userRepository.getUserById(appointment.agentId);
      if (agent) {
        const agentAgency = await agenciesRepository.getAgencyByAgentId(agent.id);
        const managerAgency = await agenciesRepository.getAgencyByManagerId(req.user!.id!);
        isAuthorized = agentAgency?.id === managerAgency?.id;
      }
    }
    else if (req.user!.role === "agent") {
      // Agente può modificare solo i suoi appuntamenti
      isAuthorized = appointment.agentId === req.user!.id;
    }

    if (!isAuthorized) {
      res.status(403).json({ message: "Non sei autorizzato a modificare questo appuntamento" });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({ message: "Utente non autenticato" });
      return;
    }

    // Aggiorna lo stato dell'appuntamento (passa anche il ruolo)
    const updated = await appointmentsRepository.updateAppointmentStatus(
      Number(putID.data.id),
      req.user.id,
      { status, notes },
      req.user.role!, // Passa il ruolo per la logica nel repository
    );

    // Recupera informazioni per l'email
    const user = await userRepository.getUserById(appointment.userId);
    const post = await postsRepository.getPostById(appointment.postId);

    if (!user || !post) {
      res.status(404).json({ message: "Utente o immobile non trovato" });
      return;
    }

    // Invia email di conferma o rifiuto al cliente
    if (status === "confirmed") {
      await sendAppointmentConfirmationEmail(
        user.email ?? undefined,
        post.title,
        new Date(appointment.requestedDate),
        notes || "",
      );
    }
    else if (status === "rejected") {
      await sendAppointmentRejectionEmail(
        user.email ?? undefined,
        post.title,
        new Date(appointment.requestedDate),
        notes || "",
      );
    }

    res.status(200).json({
      message: status === "confirmed"
        ? "Appuntamento confermato con successo"
        : "Appuntamento rifiutato",
      appointment: updated,
    });
  }
  catch (error) {
    console.error("Errore durante l'aggiornamento dell'appuntamento:", error);
    res.status(500).json({ message: "Errore durante l'aggiornamento dell'appuntamento" });
  }
});

// Elimina un appuntamento
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const deletePost = appointmentIdSchema.safeParse(req.params);
    if (deletePost.error || !deletePost.data) {
      res.status(400).json(deletePost.error);
      return;
    }
    const id = deletePost.data.id;

    // Verifica che l'appuntamento esista
    const appointment = await appointmentsRepository.getAppointmentById(id);
    if (!appointment) {
      res.status(404).json({ message: "Appuntamento non trovato" });
      return;
    }

    // Controllo autorizzazioni in base al ruolo
    let isAuthorized = false;

    if (req.user!.role === "admin" || req.user!.role === "support") {
      // Admin e Support possono eliminare tutti gli appuntamenti
      isAuthorized = true;
    }
    else if (req.user!.role === "manager") {
      // Manager può eliminare appuntamenti della sua agenzia
      const agent = await userRepository.getUserById(appointment.agentId);
      if (agent && req.user!.id) {
        const agentAgency = await agenciesRepository.getAgencyByAgentId(agent.id);
        const managerAgency = await agenciesRepository.getAgencyByManagerId(req.user!.id);
        isAuthorized = agentAgency?.id === managerAgency?.id;
      }
    }
    else if (appointment.userId === req.user!.id) {
      // Il cliente può eliminare i suoi appuntamenti
      isAuthorized = true;
    }

    if (!isAuthorized) {
      res.status(403).json({ message: "Non sei autorizzato a eliminare questo appuntamento" });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({ message: "Utente non autenticato" });
      return;
    }

    if (!req.user.role) {
      res.status(400).json({ message: "Ruolo utente non valido" });
      return;
    }

    // Elimina l'appuntamento (passa anche il ruolo)
    await appointmentsRepository.deleteAppointment(Number(id), req.user.id, req.user.role);  }
  catch (error) {
    console.error("Errore durante l'eliminazione dell'appuntamento:", error);
    res.status(500).json({ message: "Errore durante l'eliminazione dell'appuntamento" });
  }
});

// Ottieni appuntamenti in formato calendario
router.get("/calendar", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Utente non autenticato" });
      return;
    }

    // Parametri di query per il periodo (opzionali)
    const start = req.query.start ? new Date(req.query.start as string) : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;

    let appointments: any[];

    switch (req.user.role) {
      case "admin":
      case "support":
        // Admin e Support vedono tutti gli appuntamenti del sistema
        appointments = await appointmentsRepository.getAllAppointmentsForCalendar(start, end);
        break;

      case "manager": {
        // Manager vede tutti gli appuntamenti della sua agenzia
        const managerAgency = await agenciesRepository.getAgencyByManagerId(req.user.id);
        if (managerAgency) {
          appointments = await appointmentsRepository.getAppointmentsByAgencyIdForCalendar(managerAgency.id, start, end);
        }
        else {
          appointments = [];
        }
        break;
      }

      case "agent":
        // Agente vede solo i suoi appuntamenti
        appointments = await appointmentsRepository.getAppointmentsByAgentIdForCalendar(
          req.user.id,
          start,
          end,
        );
        break;

      default:
        // Cliente vede solo i suoi appuntamenti
        appointments = await appointmentsRepository.getAppointmentsByUserIdForCalendar(
          req.user.id,
          start,
          end,
        );
        break;
    }

    // Converti gli appuntamenti in formato compatibile con i calendari
    const calendarEvents = appointments.map(app => ({
      id: app.id.toString(),
      title: app.postTitle || "Visita immobile",
      start: app.requestedDate,
      end: new Date(new Date(app.requestedDate).getTime() + 60 * 60 * 1000), // 1 ora di default
      allDay: false,
      extendedProps: {
        status: app.status,
        postId: app.postId,
        address: app.address,
        clientName: app.clientName,
        agentName: app.agentName,
        agentEmail: app.agentEmail, // Aggiungi email agente
        agentPhone: app.agentPhone, // Aggiungi telefono agente
        notes: app.notes,
      },
      backgroundColor: getStatusColor(app.status),
      borderColor: getStatusColor(app.status),
    }));

    res.json(calendarEvents);
  }
  catch (error) {
    console.error("Errore durante il recupero degli appuntamenti:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});
// Funzione helper per determinare il colore in base allo stato
function getStatusColor(status: string): string {
  switch (status) {
    case "confirmed": return "#4CAF50"; // verde
    case "rejected": return "#F44336"; // rosso
    case "pending": return "#FFC107"; // giallo
    default: return "#2196F3"; // blu
  }
}

export default router;
