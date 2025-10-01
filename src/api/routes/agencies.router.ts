import express from "express";
import validate from "express-zod-safe";

import { agenciesIdSchema, agenciesInsertSchema, agenciesUpdateSchema } from "@/db/schema/agencies";
import * as agenciesRepository from "@/repository/agencies.repository";
import * as postsRepository from "@/repository/posts.repository";
import * as userRepository from "@/repository/user.repository";
import * as photoRepository from "@/repository/photos.repository";

import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { getPresignedUrl } from "@/api/middleware/photo.middleware";



const router = express.Router();

// GET tutte le agenzie
router.get("/", async (req, res) => {
  try {
    const agencies = await agenciesRepository.getAgenciesWithManagers();
    res.status(200).json(agencies);
  }
  catch (error) {
    console.error("Errore durante il recupero delle agenzie:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});

// GET agenti senza agenzia (solo admin e support)
router.get("/unassigned-agents", authMiddleware, requireRole("admin", "support"), async (req, res) => {
  try {
    const unassignedAgents = await agenciesRepository.getUnassignedAgents();
    res.status(200).json(unassignedAgents);
  }
  catch (error) {
    console.error("Errore durante il recupero degli agenti non assegnati:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});

// GET agenzia del manager corrente// GET agenti senza agenzia (solo admin e support)
router.get("/unassigned-agents", authMiddleware, requireRole("admin", "support"), async (req, res) => {
  try {
    const unassignedAgents = await agenciesRepository.getUnassignedAgents();
    res.status(200).json(unassignedAgents);
  }
  catch (error) {
    console.error("Errore durante il recupero degli agenti non assegnati:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});
router.get("/my-agency", authMiddleware, requireRole("manager"), async (req, res) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: "Utente non autenticato" });
      return;
    }

    const agency = await agenciesRepository.getAgencyByManagerId(req.user.id);
    if (!agency) {
      res.status(404).json({ message: "Agenzia non trovata" });
      return;
    }

    res.status(200).json(agency);
  }
  catch (error) {
    console.error("Errore durante il recupero dell'agenzia del manager:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});

// GET agenzia specifica
router.get("/:id", validate({ params: agenciesIdSchema }), async (req, res) => {
  try {
    const agencyId = Number(req.params.id);
    const agency = await agenciesRepository.getAgencyById(agencyId);

    if (!agency) {
      res.status(404).json({ message: "Agenzia non trovata" });
      return;
    }

    res.status(200).json(agency);
  }
  catch (error) {
    console.error("Errore durante il recupero dell'agenzia:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});

// POST crea agenzia (admin o manager - una sola volta)
router.post(
  "/",
  authMiddleware,
  requireRole("admin", "manager"),
  validate({ body: agenciesInsertSchema }),
  async (req, res) => {
    try {
      if (req.user?.role === "admin") {
        const agency = await agenciesRepository.createAgency(req.body);
        res.status(201).json(agency);
        return;
      }

      if (req.user?.role === "manager") {
        if (!req.user.id) {
          res.status(401).json({ message: "ID utente non trovato" });
          return;
        }

        const canCreate = await agenciesRepository.canManagerCreateAgency(req.user.id);
        if (!canCreate) {
          res.status(403).json({ message: "Hai già creato un'agenzia o non hai i permessi necessari" });
          return;
        }

        const agency = await agenciesRepository.createAgencyForManager(req.body, req.user.id);
        res.status(201).json(agency);
        return;
      }

      res.status(403).json({ message: "Ruolo non autorizzato" });
    }
    catch (error) {
      console.error("Errore durante la creazione dell'agenzia:", error);

      if (error instanceof Error && error.message === "Il manager ha già creato un'agenzia") {
        res.status(403).json({ message: error.message });
      }
      else {
        res.status(500).json({ message: "Errore interno del server" });
      }
    }
  },
);

// PUT aggiorna agenzia (admin o manager dell'agenzia)
router.put(
  "/:id",
  authMiddleware,
  async (req, res) => {
    const putID = agenciesIdSchema.safeParse(req.params);
    if (putID.error || !putID.data) {
      res.status(400).json(putID.error);
      return;
    }

    const putBody = agenciesUpdateSchema.safeParse(req.body);
    if (putBody.error || !putBody.data) {
      res.status(400).json(putBody.error);
      return;
    }

    try {
      const existingAgency = await agenciesRepository.getAgencyById(putID.data.id);

      if (!existingAgency) {
        res.status(404).json({ message: "Agenzia non trovata" });
        return;
      }

      if (req.user?.role !== "admin" && existingAgency.managerId !== req.user?.id) {
        res.status(403).json({ message: "Non autorizzato ad aggiornare questa agenzia" });
        return;
      }

      const updatedAgency = await agenciesRepository.updateAgency(putID.data.id, putBody.data);
      res.status(200).json(updatedAgency);
    }
    catch (error) {
      console.error("Errore durante l'aggiornamento dell'agenzia:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  },
);

// DELETE elimina agenzia (solo admin)
router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    const deletePost = agenciesIdSchema.safeParse(req.params);
    if (deletePost.error || !deletePost.data) {
      res.status(400).json(deletePost.error);
      return;
    }

    try {
      const agencyId = Number(req.params.id);
      const agency = await agenciesRepository.getAgencyById(agencyId);

      if (!agency) {
        res.status(404).json({ message: "Agenzia non trovata" });
        return;
      }

      const deletedAgency = await agenciesRepository.deleteAgency(agencyId);
      res.status(200).json(deletedAgency);
    }
    catch (error) {
      console.error("Errore durante l'eliminazione dell'agenzia:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  },
);

// GET immobili di un'agenzia
router.get("/:id/properties", validate({ params: agenciesIdSchema }), async (req, res) => {
  try {
    const agencyId = Number(req.params.id);
    const agency = await agenciesRepository.getAgencyById(agencyId);

    if (!agency) {
      res.status(404).json({ message: "Agenzia non trovata" });
      return;
    }

    const posts = await postsRepository.getPostsByAgencyId(agencyId);
    
    // Aggiungi le foto a ogni post con presigned URLs
    const postsWithPhotos = await Promise.all(
      posts.map(async (post) => {
        const photos = await photoRepository.getAllPhotoByPostId(post.id);
        const photosWithUrls = await Promise.all(
          photos.map(async photo => ({
            ...photo,
            url: await getPresignedUrl(photo.filename),
          })),
        );
        return { ...post, photos: photosWithUrls };
      }),
    );

    res.status(200).json(postsWithPhotos);
  }
  catch (error) {
    console.error("Errore durante il recupero degli immobili dell'agenzia:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});

// GET agenti di un'agenzia
router.get("/:id/agents", validate({ params: agenciesIdSchema }), async (req, res) => {
  try {
    const agencyId = Number(req.params.id);
    const agency = await agenciesRepository.getAgencyById(agencyId);

    if (!agency) {
      res.status(404).json({ message: "Agenzia non trovata" });
      return;
    }

    const agents = await agenciesRepository.getAgentsByAgencyId(agencyId);
    res.status(200).json(agents);
  }
  catch (error) {
    console.error("Errore durante il recupero degli agenti dell'agenzia:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});

// POST assegna agente all'agenzia (solo admin o manager dell'agenzia)
router.post(
  "/:id/assign-agent/:userId",
  authMiddleware,
  async (req, res) => {
    try {
      const agencyId = Number(req.params.id);
      const userId = Number(req.params.userId);

      const agency = await agenciesRepository.getAgencyById(agencyId);

      if (!agency) {
        res.status(404).json({ message: "Agenzia non trovata" });
        return;
      }

      // Verifica che l'utente esista e sia un agente
      const userToAssign = await userRepository.getUserById(userId);
      if (!userToAssign) {
        res.status(404).json({ message: "Utente non trovato" });
        return;
      }

      // Verifica che l'utente sia un agente
      const agentRole = await userRepository.getRoleId("agent");
      if (userToAssign.roleId !== agentRole) {
        res.status(400).json({ message: "L'utente non è un agente" });
        return;
      }

      // Verifica autorizzazioni
      if (req.user?.role !== "admin" && agency.managerId !== req.user?.id) {
        res.status(403).json({ message: "Non autorizzato ad assegnare agenti a questa agenzia" });
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
      res.status(500).json({ message: "Errore interno del server" });
    }
  },
);

// DELETE rimuovi agente dall'agenzia (RESTful e corretto)
router.delete(
  "/:agencyId/agents/:userId",
  authMiddleware,
  async (req, res) => {
    try {
      const agencyId = Number(req.params.agencyId);
      const userId = Number(req.params.userId);

      // Verifica che l'agenzia esista
      const agency = await agenciesRepository.getAgencyById(agencyId);
      if (!agency) {
        res.status(404).json({ message: "Agenzia non trovata" });
        return;
      }

      // Verifica che l'utente esista e appartenga all'agenzia
      const agents = await agenciesRepository.getAgentsByAgencyId(agencyId);
      const userToRemove = agents.find(agent => agent.id === userId);

      if (!userToRemove) {
        res.status(404).json({ message: "Utente non trovato in questa agenzia" });
        return;
      }

      // Verifica autorizzazioni
      if (req.user?.role !== "admin" && agency.managerId !== req.user?.id) {
        res.status(403).json({ message: "Non autorizzato a rimuovere agenti da questa agenzia" });
        return;
      }

      // Impedisci al manager di rimuovere se stesso
      if (req.user?.role === "manager" && userId === req.user.id) {
        res.status(403).json({ message: "Un manager non può rimuovere se stesso dall'agenzia" });
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
      res.status(500).json({ message: "Errore interno del server" });
    }
  },
);

export default router;
