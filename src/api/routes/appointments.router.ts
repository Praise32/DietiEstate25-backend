import express from "express";
import { type Request, type Response } from "express";
import validate from "express-zod-safe";

import { authMiddleware } from "@/api/middleware/auth.middleware";
import { requireRole } from "@/api/middleware/role.middleware";
import { getWeatherForecast, formatWeatherData } from "@/utils/weatherService";
import { 
    appointmentApiSchema,
  appointmentIdSchema,
  appointmentStatusUpdateSchema 
} from "@/db/schema/appointments";
import * as appointmentsRepository from "@/repository/appointments.repository";
import * as postsRepository from "@/repository/posts.repository";
import * as userRepository from "@/repository/user.repository";
import { sendAppointmentConfirmationEmail, sendAppointmentNotificationEmail, sendAppointmentRejectionEmail } from "@/utils/email";
import passport from "@/utils/passport";

const router = express.Router();

// Richiesta di una nuova visita
router.post("/", 
  authMiddleware,
  validate({ body: appointmentApiSchema }), 
  async (req: Request, res: Response) => {
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
        appointment.id
      );

      res.status(201).json({
        message: "Richiesta di visita inviata con successo",
        appointment,
      });
    } catch (error) {
      console.error("Errore durante la creazione dell'appuntamento:", error);
      res.status(500).json({ message: "Errore durante la richiesta di visita" });
    }
  }
);

// Ottieni appuntamenti (differenziati per ruolo)
router.get("/", 
  authMiddleware, 
  async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ message: "Utente non autenticato" });
        return;
      }

      let appointments;
      
      // Se l'utente è un agente, visualizza gli appuntamenti per i suoi immobili
      if (["agent", "admin", "manager"].includes(req.user.role || "")) {
        appointments = await appointmentsRepository.getAppointmentsByAgentId(req.user.id);
      } 
      // Altrimenti mostra gli appuntamenti richiesti dall'utente
      else {
        appointments = await appointmentsRepository.getAppointmentsByUserId(req.user.id);
      }

      res.status(200).json(appointments);
    } catch (error) {
      console.error("Errore durante il recupero degli appuntamenti:", error);
      res.status(500).json({ message: "Errore durante il recupero degli appuntamenti" });
    }
  }
);

// Conferma o rifiuta un appuntamento (solo agenti)
router.put("/:id",
  passport.authenticate("jwt", { session: false }),
  requireRole("agent", "admin", "manager"),
  async (req: Request, res: Response) => {
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

      // Verifica che l'agente sia autorizzato
      if (appointment.agentId !== req.user!.id) {
        res.status(403).json({ message: "Non sei autorizzato a modificare questo appuntamento" });
        return;
      }

      // Aggiorna lo stato dell'appuntamento
      const updated = await appointmentsRepository.updateAppointmentStatus(
        Number(putID.data.id),
        req.user!.id,
        { status, notes }
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
          notes || ""
        );
      } else if (status === "rejected") {
        await sendAppointmentRejectionEmail(
          user.email ?? undefined,
          post.title,
          new Date(appointment.requestedDate),
          notes || ""
        );
      }

      res.status(200).json({
        message: status === "confirmed" 
          ? "Appuntamento confermato con successo" 
          : "Appuntamento rifiutato",
        appointment: updated
      });
    } catch (error) {
      console.error("Errore durante l'aggiornamento dell'appuntamento:", error);
      res.status(500).json({ message: "Errore durante l'aggiornamento dell'appuntamento" });
    }
  }
);

// Elimina un appuntamento (solo il cliente che l'ha richiesto)
router.delete("/:id",
  authMiddleware,
  async (req: Request, res: Response) => {
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

      // Verifica che l'utente sia autorizzato (solo il cliente che ha richiesto la visita)
      if (appointment.userId !== req.user!.id) {
        res.status(403).json({ message: "Non sei autorizzato a eliminare questo appuntamento" });
        return;
      }

      // Elimina l'appuntamento
      await appointmentsRepository.deleteAppointment(Number(id), req.user!.id);

      res.status(200).json({ message: "Appuntamento cancellato con successo" });
    } catch (error) {
      console.error("Errore durante l'eliminazione dell'appuntamento:", error);
      res.status(500).json({ message: "Errore durante l'eliminazione dell'appuntamento" });
    }
  }
);

// Ottieni appuntamenti in formato calendario
router.get("/calendar", 
  authMiddleware, 
  async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        res.status(401).json({ message: "Utente non autenticato" });
        return;
      }

      // Parametri di query per il periodo (opzionali)
      const start = req.query.start ? new Date(req.query.start as string) : undefined;
      const end = req.query.end ? new Date(req.query.end as string) : undefined;

      let appointments;
      
      // Se l'utente è un agente, visualizza gli appuntamenti per i suoi immobili
      if (["agent", "admin", "manager"].includes(req.user.role || "")) {
        appointments = await appointmentsRepository.getAppointmentsByAgentIdForCalendar(
          req.user.id,
          start,
          end
        );
      } 
      // Altrimenti mostra gli appuntamenti richiesti dall'utente
      else {
        appointments = await appointmentsRepository.getAppointmentsByUserIdForCalendar(
          req.user.id,
          start,
          end
        );
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
          notes: app.notes
        },
        backgroundColor: getStatusColor(app.status),
        borderColor: getStatusColor(app.status),
      }));

      res.json(calendarEvents);
    } catch (error) {
      console.error("Errore durante il recupero degli appuntamenti:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  }
);

// Funzione helper per determinare il colore in base allo stato
function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed': return '#4CAF50'; // verde
    case 'rejected': return '#F44336'; // rosso
    case 'pending': return '#FFC107'; // giallo
    default: return '#2196F3'; // blu
  }
}


// Ottieni previsioni meteo per un immobile
router.get("/weather/:postId", 
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      
      // Verifica che l'immobile esista
      const post = await postsRepository.getPostById(postId);
      if (!post) {
        res.status(404).json({ message: "Immobile non trovato" });
        return;
      }
      
      // Estrai coordinate dall'immobile
      // Siccome i dati geografici sono salvati in formato PostGIS, dobbiamo estrarre lat e lon
      const latitude = post.location.lat;
      const longitude = post.location.lon;
      
      // Ottieni previsioni per i prossimi 14 giorni (per la pianificazione delle visite)
      const forecast = await getWeatherForecast(latitude, longitude, 14);
      
      // Formatta i dati per un uso più semplice dal frontend
      const formattedForecast = formatWeatherData(forecast);
      
      res.status(200).json(formattedForecast);
    } catch (error) {
      console.error("Errore durante il recupero delle previsioni meteo:", error);
      res.status(500).json({ message: "Errore durante il recupero delle previsioni meteo" });
    }
  }
);

export default router;