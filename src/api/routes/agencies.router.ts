import express from "express";
import validate from "express-zod-safe";

import { agenciesIdSchema, agenciesInsertSchema, agenciesUpdateSchema } from "@/db/schema/agencies";
import * as agenciesRepository from "@/repository/agencies.repository";
import * as postsRepository from "@/repository/posts.repository";

import { authMiddleware } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = express.Router();

// GET tutte le agenzie
router.get("/", async (req, res) => {
  try {
    const agencies = await agenciesRepository.getAgenciesWithManagers();
    res.status(200).json(agencies);
  } catch (error) {
    console.error("Errore durante il recupero delle agenzie:", error);
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
  } catch (error) {
    console.error("Errore durante il recupero dell'agenzia:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});

// POST crea agenzia (solo admin)
router.post(
  "/", 
  authMiddleware, 
  requireRole("admin"),
  validate({ body: agenciesInsertSchema }), 
  async (req, res) => {
    try {
      const agency = await agenciesRepository.createAgency(req.body);
      res.status(201).json(agency);
    } catch (error) {
      console.error("Errore durante la creazione dell'agenzia:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  }
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
      
        if (!putID.data.id) {
           res.status(400).json({ message: "ID agenzia mancante" });
              return;
        } 

      // Verifica se l'utente è admin o manager dell'agenzia
      if (req.user?.role !== "admin" && putBody.data.managerId !== req.user?.id) {
         res.status(403).json({ message: "Non autorizzato ad aggiornare questa agenzia" });
            return;
      }
      
      const updatedAgency = await agenciesRepository.updateAgency(putID.data.id, putBody.data);
      res.status(200).json(updatedAgency);
    } catch (error) {
      console.error("Errore durante l'aggiornamento dell'agenzia:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  }
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
    } catch (error) {
      console.error("Errore durante l'eliminazione dell'agenzia:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  }
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
    res.status(200).json(posts);
  } catch (error) {
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
  } catch (error) {
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
      
      // Verifica se l'utente è admin o manager dell'agenzia
      if (req.user?.role !== "admin" && agency.managerId !== req.user?.id) {
         res.status(403).json({ message: "Non autorizzato ad assegnare agenti a questa agenzia" });
            return;
      }
      
      const updatedUser = await agenciesRepository.assignAgentToAgency(userId, agencyId);
      
      if (!updatedUser) {
         res.status(404).json({ message: "Utente non trovato" });
            return;
      }
      
      res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Errore durante l'assegnazione dell'agente all'agenzia:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  }
);

// POST rimuovi agente dall'agenzia (solo admin o manager dell'agenzia)
router.post(
  "/remove-agent/:userId",
  authMiddleware,
  async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      
      // Ottieni l'agencyId dell'utente
      const userToUpdate = await agenciesRepository.getAgentsByAgencyId(userId);
      
      if (!userToUpdate || userToUpdate.length === 0) {
         res.status(404).json({ message: "Utente non trovato o non appartiene a nessuna agenzia" });
            return;
      }
      
      // Verifica se l'utente è admin o manager dell'agenzia
      if (req.user?.role !== "admin") {
        const agencyId = userToUpdate[0].agencyId;
        if (agencyId === null) {
          res.status(403).json({ message: "Non autorizzato a rimuovere agenti da questa agenzia" });
          return;
        }
        const agency = await agenciesRepository.getAgencyById(agencyId);
        
        if (!agency || agency.managerId !== req.user?.id) {
           res.status(403).json({ message: "Non autorizzato a rimuovere agenti da questa agenzia" });
              return;
        }
      }
      
      const updatedUser = await agenciesRepository.removeAgentFromAgency(userId);
      
      res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Errore durante la rimozione dell'agente dall'agenzia:", error);
      res.status(500).json({ message: "Errore interno del server" });
    }
  }
);

export default router;