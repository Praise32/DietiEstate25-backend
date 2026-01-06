import express from "express";
import validate from "express-zod-safe";
import { agenciesIdSchema, agenciesInsertSchema, agenciesUpdateSchema } from "../../db/schema/agencies.js";
import * as agenciesRepository from "../../repository/agencies.repository.js";
import * as postsRepository from "../../repository/posts.repository.js";
import * as userRepository from "../../repository/user.repository.js";
import { enrichPostWithPhotos, sendBadRequestResponse, sendForbiddenResponse, sendInternalErrorResponse, sendNotFoundResponse, sendUnauthorizedResponse, } from "../../utils/index.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
const router = express.Router();
router.get("/", async (_req, res) => {
    try {
        const agencies = await agenciesRepository.getAgenciesWithManagers();
        res.status(200).json(agencies);
    }
    catch (error) {
        console.error("Errore durante il recupero delle agenzie:", error);
        sendInternalErrorResponse(res);
    }
});
router.get("/unassigned-agents", authMiddleware, requireRole("admin", "support"), async (_req, res) => {
    try {
        const unassignedAgents = await agenciesRepository.getUnassignedAgents();
        res.status(200).json(unassignedAgents);
    }
    catch (error) {
        console.error("Errore durante il recupero degli agenti non assegnati:", error);
        sendInternalErrorResponse(res);
    }
});
async function fetchAuthenticatedUserAgency(userId) {
    const agency = await agenciesRepository.getAgencyByManagerId(userId);
    return agency;
}
router.get("/my-agency", authMiddleware, requireRole("manager"), async (req, res) => {
    try {
        if (!req.user?.id) {
            sendUnauthorizedResponse(res);
            return;
        }
        const agency = await fetchAuthenticatedUserAgency(req.user.id);
        if (!agency) {
            sendNotFoundResponse(res, "Agenzia non trovata");
            return;
        }
        res.status(200).json(agency);
    }
    catch (error) {
        console.error("Errore durante il recupero dell'agenzia del manager:", error);
        sendInternalErrorResponse(res);
    }
});
router.get("/:id", validate({ params: agenciesIdSchema }), async (req, res) => {
    try {
        const agencyId = Number(req.params.id);
        const agency = await agenciesRepository.getAgencyById(agencyId);
        if (!agency) {
            sendNotFoundResponse(res, "Agenzia non trovata");
            return;
        }
        res.status(200).json(agency);
    }
    catch (error) {
        console.error("Errore durante il recupero dell'agenzia:", error);
        sendInternalErrorResponse(res);
    }
});
async function createAgencyAsAdminOrSupport(agencyData) {
    return agenciesRepository.createAgency(agencyData);
}
async function createAgencyAsManager(agencyData, managerId) {
    const canCreate = await agenciesRepository.canManagerCreateAgency(managerId);
    if (!canCreate) {
        throw new Error("MANAGER_ALREADY_CREATED_AGENCY");
    }
    return agenciesRepository.createAgencyForManager(agencyData, managerId);
}
router.post("/", authMiddleware, requireRole("admin", "support", "manager"), validate({ body: agenciesInsertSchema }), async (req, res) => {
    try {
        if (req.user?.role === "admin" || req.user?.role === "support") {
            const agency = await createAgencyAsAdminOrSupport(req.body);
            res.status(201).json(agency);
            return;
        }
        if (req.user?.role === "manager") {
            if (!req.user.id) {
                sendUnauthorizedResponse(res, "ID utente non trovato");
                return;
            }
            const agency = await createAgencyAsManager(req.body, req.user.id);
            res.status(201).json(agency);
            return;
        }
        sendForbiddenResponse(res, "Ruolo non autorizzato");
    }
    catch (error) {
        console.error("Errore durante la creazione dell'agenzia:", error);
        if (error instanceof Error) {
            if (error.message === "Il manager ha già creato un'agenzia" || error.message === "MANAGER_ALREADY_CREATED_AGENCY") {
                sendForbiddenResponse(res, "Hai già creato un'agenzia o non hai i permessi necessari");
                return;
            }
        }
        sendInternalErrorResponse(res);
    }
});
async function isUserAuthorizedToUpdateAgency(userId, userRole, agency) {
    if (userRole === "admin" || userRole === "support") {
        return true;
    }
    if (agency.managerId !== null && userId === agency.managerId) {
        return true;
    }
    return false;
}
router.put("/:id", authMiddleware, async (req, res) => {
    const paramValidation = agenciesIdSchema.safeParse(req.params);
    if (!paramValidation.success || !paramValidation.data) {
        sendBadRequestResponse(res, paramValidation.error);
        return;
    }
    const bodyValidation = agenciesUpdateSchema.safeParse(req.body);
    if (!bodyValidation.success || !bodyValidation.data) {
        sendBadRequestResponse(res, bodyValidation.error);
        return;
    }
    try {
        const existingAgency = await agenciesRepository.getAgencyById(paramValidation.data.id);
        if (!existingAgency) {
            sendNotFoundResponse(res, "Agenzia non trovata");
            return;
        }
        const isAuthorized = await isUserAuthorizedToUpdateAgency(req.user?.id, req.user?.role, existingAgency);
        if (!isAuthorized) {
            sendForbiddenResponse(res, "Non autorizzato ad aggiornare questa agenzia");
            return;
        }
        const updatedAgency = await agenciesRepository.updateAgency(paramValidation.data.id, bodyValidation.data);
        res.status(200).json(updatedAgency);
    }
    catch (error) {
        console.error("Errore durante l'aggiornamento dell'agenzia:", error);
        sendInternalErrorResponse(res);
    }
});
router.delete("/:id", authMiddleware, requireRole("admin", "support"), async (req, res) => {
    const deleteValidation = agenciesIdSchema.safeParse(req.params);
    if (!deleteValidation.success || !deleteValidation.data) {
        sendBadRequestResponse(res, deleteValidation.error);
        return;
    }
    try {
        const agencyId = Number(req.params.id);
        const agency = await agenciesRepository.getAgencyById(agencyId);
        if (!agency) {
            sendNotFoundResponse(res, "Agenzia non trovata");
            return;
        }
        const deletedAgency = await agenciesRepository.deleteAgency(agencyId);
        res.status(200).json(deletedAgency);
    }
    catch (error) {
        console.error("Errore durante l'eliminazione dell'agenzia:", error);
        sendInternalErrorResponse(res);
    }
});
async function fetchAgencyPosts(agencyId) {
    const posts = await postsRepository.getPostsByAgencyId(agencyId);
    return Promise.all(posts.map((post) => enrichPostWithPhotos(post)));
}
router.get("/:id/properties", validate({ params: agenciesIdSchema }), async (req, res) => {
    try {
        const agencyId = Number(req.params.id);
        const agency = await agenciesRepository.getAgencyById(agencyId);
        if (!agency) {
            sendNotFoundResponse(res, "Agenzia non trovata");
            return;
        }
        const postsWithPhotos = await fetchAgencyPosts(agencyId);
        res.status(200).json(postsWithPhotos);
    }
    catch (error) {
        console.error("Errore durante il recupero degli immobili dell'agenzia:", error);
        sendInternalErrorResponse(res);
    }
});
router.get("/:id/agents", validate({ params: agenciesIdSchema }), async (req, res) => {
    try {
        const agencyId = Number(req.params.id);
        const agency = await agenciesRepository.getAgencyById(agencyId);
        if (!agency) {
            sendNotFoundResponse(res, "Agenzia non trovata");
            return;
        }
        const agents = await agenciesRepository.getAgentsByAgencyId(agencyId);
        res.status(200).json(agents);
    }
    catch (error) {
        console.error("Errore durante il recupero degli agenti dell'agenzia:", error);
        sendInternalErrorResponse(res);
    }
});
async function validateAgentAssignment(userId) {
    const userToAssign = await userRepository.getUserById(userId);
    if (!userToAssign) {
        throw new Error("USER_NOT_FOUND");
    }
    const agentRole = await userRepository.getRoleId("agent");
    if (userToAssign.roleId !== agentRole) {
        throw new Error("USER_NOT_AGENT");
    }
    return userToAssign;
}
async function isAuthorizedToManageAgency(userId, userRole, agency) {
    if (userRole === "admin" || userRole === "support") {
        return true;
    }
    if (agency.managerId !== null && userId === agency.managerId) {
        return true;
    }
    return false;
}
router.post("/:id/assign-agent/:userId", authMiddleware, async (req, res) => {
    try {
        const agencyId = Number(req.params.id);
        const userId = Number(req.params.userId);
        const agency = await agenciesRepository.getAgencyById(agencyId);
        if (!agency) {
            sendNotFoundResponse(res, "Agenzia non trovata");
            return;
        }
        await validateAgentAssignment(userId);
        const isAuthorized = await isAuthorizedToManageAgency(req.user?.id, req.user?.role, agency);
        if (!isAuthorized) {
            sendForbiddenResponse(res, "Non autorizzato ad assegnare agenti a questa agenzia");
            return;
        }
        const result = await agenciesRepository.assignAgentToAgency(userId, agencyId);
        res.status(200).json({
            message: "Agente assegnato all'agenzia con successo",
            user: result.user,
            updatedPostsCount: result.updatedPostsCount,
            details: `Aggiornati ${result.updatedPostsCount} immobili dell'agente`,
        });
    }
    catch (error) {
        console.error("Errore durante l'assegnazione dell'agente all'agenzia:", error);
        if (error instanceof Error) {
            if (error.message === "USER_NOT_FOUND") {
                sendNotFoundResponse(res, "Utente non trovato");
                return;
            }
            if (error.message === "USER_NOT_AGENT") {
                sendBadRequestResponse(res, "L'utente non è un agente");
                return;
            }
        }
        sendInternalErrorResponse(res);
    }
});
async function validateAgentRemoval(agencyId, userId, currentUserId, currentUserRole) {
    const agents = await agenciesRepository.getAgentsByAgencyId(agencyId);
    const userToRemove = agents.find(agent => agent.id === userId);
    if (!userToRemove) {
        throw new Error("AGENT_NOT_IN_AGENCY");
    }
    if (currentUserRole === "manager" && userId === currentUserId) {
        throw new Error("MANAGER_CANNOT_REMOVE_SELF");
    }
}
router.delete("/:agencyId/agents/:userId", authMiddleware, async (req, res) => {
    try {
        const agencyId = Number(req.params.agencyId);
        const userId = Number(req.params.userId);
        const agency = await agenciesRepository.getAgencyById(agencyId);
        if (!agency) {
            sendNotFoundResponse(res, "Agenzia non trovata");
            return;
        }
        await validateAgentRemoval(agencyId, userId, req.user?.id, req.user?.role);
        const isAuthorized = await isAuthorizedToManageAgency(req.user?.id, req.user?.role, agency);
        if (!isAuthorized) {
            sendForbiddenResponse(res, "Non autorizzato a rimuovere agenti da questa agenzia");
            return;
        }
        const result = await agenciesRepository.removeAgentFromAgency(userId);
        res.status(200).json({
            message: "Agente rimosso dall'agenzia con successo",
            user: result.user,
            updatedPostsCount: result.updatedPostsCount,
            details: `Rimosso agencyId da ${result.updatedPostsCount} immobili dell'agente`,
        });
    }
    catch (error) {
        console.error("Errore durante la rimozione dell'agente dall'agenzia:", error);
        if (error instanceof Error) {
            if (error.message === "AGENT_NOT_IN_AGENCY") {
                sendNotFoundResponse(res, "Utente non trovato in questa agenzia");
                return;
            }
            if (error.message === "MANAGER_CANNOT_REMOVE_SELF") {
                sendForbiddenResponse(res, "Un manager non può rimuovere se stesso dall'agenzia");
                return;
            }
        }
        sendInternalErrorResponse(res);
    }
});
export default router;
