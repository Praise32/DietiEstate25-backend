import express from "express";
import validate from "express-zod-safe";
import { authMiddleware } from "../../api/middleware/auth.middleware.js";
import { requireRole } from "../../api/middleware/role.middleware.js";
import { appointmentApiSchema, appointmentIdSchema, appointmentStatusUpdateSchema, } from "../../db/schema/appointments.js";
import * as agenciesRepository from "../../repository/agencies.repository.js";
import * as appointmentsRepository from "../../repository/appointments.repository.js";
import * as postsRepository from "../../repository/posts.repository.js";
import * as userRepository from "../../repository/user.repository.js";
import { sendAppointmentConfirmationEmail, sendAppointmentNotificationEmail, sendAppointmentRejectionEmail, sendAppointmentRescheduledEmail } from "../../utils/email.js";
import passport from "../../utils/passport.js";
const router = express.Router();
router.post("/", authMiddleware, validate({ body: appointmentApiSchema }), async (req, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ message: "Utente non autenticato" });
            return;
        }
        const post = await postsRepository.getPostById(req.body.postId);
        if (!post) {
            res.status(404).json({ message: "Immobile non trovato" });
            return;
        }
        const agent = await userRepository.getUserById(post.userId);
        if (!agent) {
            res.status(404).json({ message: "Agente non trovato" });
            return;
        }
        const appointment = await appointmentsRepository.createAppointment({
            ...req.body,
            userId: req.user.id,
            agentId: post.userId,
        });
        await sendAppointmentNotificationEmail(agent.email ?? undefined, req.user.name || "Cliente", post.title, new Date(req.body.requestedDate), appointment.id);
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
router.get("/", authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId || !userRole) {
            res.status(401).json({ message: "Utente non autenticato" });
            return;
        }
        let appointments;
        switch (userRole) {
            case "admin":
            case "support":
                appointments = await appointmentsRepository.getAllAppointments();
                break;
            case "manager": {
                const managerAgency = await agenciesRepository.getAgencyByManagerId(userId);
                appointments = managerAgency
                    ? await appointmentsRepository.getAppointmentsByAgencyId(managerAgency.id)
                    : [];
                break;
            }
            case "agent":
                appointments = await appointmentsRepository.getAppointmentsByAgentId(userId);
                break;
            default:
                appointments = await appointmentsRepository.getAppointmentsByUserId(userId);
                break;
        }
        res.status(200).json(appointments);
    }
    catch (error) {
        console.error("Errore durante il recupero degli appuntamenti:", error);
        res.status(500).json({ message: "Errore durante il recupero degli appuntamenti" });
    }
});
async function checkUpdateAuthorization(userRole, userId, appointment) {
    if (userRole === "admin" || userRole === "support") {
        return true;
    }
    if (userRole === "manager") {
        const agent = await userRepository.getUserById(appointment.agentId);
        if (agent) {
            const agentAgency = await agenciesRepository.getAgencyByAgentId(agent.id);
            const managerAgency = await agenciesRepository.getAgencyByManagerId(userId);
            return agentAgency?.id === managerAgency?.id;
        }
    }
    if (userRole === "agent") {
        return appointment.agentId === userId;
    }
    return false;
}
async function checkDeleteAuthorization(userRole, userId, appointment) {
    if (userRole === "admin" || userRole === "support") {
        return true;
    }
    if (userRole === "manager") {
        const agent = await userRepository.getUserById(appointment.agentId);
        if (agent) {
            const agentAgency = await agenciesRepository.getAgencyByAgentId(agent.id);
            const managerAgency = await agenciesRepository.getAgencyByManagerId(userId);
            return agentAgency?.id === managerAgency?.id;
        }
    }
    return appointment.userId === userId;
}
async function sendAppointmentEmail(status, user, post, appointmentDate, notes) {
    if (status === "confirmed") {
        await sendAppointmentConfirmationEmail(user.email ?? undefined, post.title, appointmentDate, notes || "");
    }
    else if (status === "rejected") {
        await sendAppointmentRejectionEmail(user.email ?? undefined, post.title, appointmentDate, notes || "");
    }
}
router.put("/:id", passport.authenticate("jwt", { session: false }), requireRole("agent", "admin", "manager", "support"), async (req, res) => {
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
        const appointment = await appointmentsRepository.getAppointmentById(putID.data.id);
        if (!appointment) {
            res.status(404).json({ message: "Appuntamento non trovato" });
            return;
        }
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId || !userRole) {
            res.status(401).json({ message: "Utente non autenticato" });
            return;
        }
        const isAuthorized = await checkUpdateAuthorization(userRole, userId, appointment);
        if (!isAuthorized) {
            res.status(403).json({ message: "Non sei autorizzato a modificare questo appuntamento" });
            return;
        }
        const updated = await appointmentsRepository.updateAppointmentStatus(Number(putID.data.id), userId, { status, notes }, userRole);
        const user = await userRepository.getUserById(appointment.userId);
        const post = await postsRepository.getPostById(appointment.postId);
        if (!user || !post) {
            res.status(404).json({ message: "Utente o immobile non trovato" });
            return;
        }
        await sendAppointmentEmail(status, user, post, new Date(appointment.requestedDate), notes);
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
router.patch("/:id/reschedule", passport.authenticate("jwt", { session: false }), requireRole("agent", "admin", "manager", "support"), async (req, res) => {
    try {
        const parseId = appointmentIdSchema.safeParse(req.params);
        if (parseId.error || !parseId.data) {
            res.status(400).json(parseId.error);
            return;
        }
        const { requestedDate, notes } = req.body;
        if (!requestedDate) {
            res.status(400).json({ message: "La nuova data è obbligatoria" });
            return;
        }
        const appointment = await appointmentsRepository.getAppointmentById(parseId.data.id);
        if (!appointment) {
            res.status(404).json({ message: "Appuntamento non trovato" });
            return;
        }
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId || !userRole) {
            res.status(401).json({ message: "Utente non autenticato" });
            return;
        }
        const isAuthorized = await checkUpdateAuthorization(userRole, userId, appointment);
        if (!isAuthorized) {
            res.status(403).json({ message: "Non sei autorizzato a modificare questo appuntamento" });
            return;
        }
        const oldDate = new Date(appointment.requestedDate);
        const updated = await appointmentsRepository.rescheduleAppointment(Number(parseId.data.id), new Date(requestedDate), notes);
        const user = await userRepository.getUserById(appointment.userId);
        const post = await postsRepository.getPostById(appointment.postId);
        if (user && post && user.email) {
            await sendAppointmentRescheduledEmail(user.email, post.title, oldDate, new Date(requestedDate), notes);
        }
        res.status(200).json({
            message: "Appuntamento riprogrammato con successo",
            appointment: updated,
        });
    }
    catch (error) {
        console.error("Errore durante il reschedule dell'appuntamento:", error);
        res.status(500).json({ message: "Errore durante la riprogrammazione dell'appuntamento" });
    }
});
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const deletePost = appointmentIdSchema.safeParse(req.params);
        if (deletePost.error || !deletePost.data) {
            res.status(400).json(deletePost.error);
            return;
        }
        const id = deletePost.data.id;
        const appointment = await appointmentsRepository.getAppointmentById(id);
        if (!appointment) {
            res.status(404).json({ message: "Appuntamento non trovato" });
            return;
        }
        const userId = req.user?.id;
        const userRole = req.user?.role;
        if (!userId || !userRole) {
            res.status(401).json({ message: "Utente non autenticato" });
            return;
        }
        const isAuthorized = await checkDeleteAuthorization(userRole, userId, appointment);
        if (!isAuthorized) {
            res.status(403).json({ message: "Non sei autorizzato a eliminare questo appuntamento" });
            return;
        }
        await appointmentsRepository.deleteAppointment(Number(id), userId, userRole);
    }
    catch (error) {
        console.error("Errore durante l'eliminazione dell'appuntamento:", error);
        res.status(500).json({ message: "Errore durante l'eliminazione dell'appuntamento" });
    }
});
router.get("/slots", async (req, res) => {
    try {
        const agentId = req.query.agentId ? Number(req.query.agentId) : undefined;
        const postId = req.query.postId ? Number(req.query.postId) : undefined;
        const start = req.query.start ? new Date(req.query.start) : undefined;
        const end = req.query.end ? new Date(req.query.end) : undefined;
        if (!agentId && !postId) {
            res.status(400).json({ message: "Specificare almeno agentId o postId" });
            return;
        }
        const slots = await appointmentsRepository.getOccupiedSlots({
            agentId,
            postId,
            start,
            end,
        });
        res.json(slots);
    }
    catch (error) {
        console.error("Errore durante il recupero degli slot:", error);
        res.status(500).json({ message: "Errore interno del server" });
    }
});
export default router;
