import { and, desc, eq, isNull } from "drizzle-orm";

import type { AgenciesInsertSchema, AgenciesUpdateSchema } from "@/db/schema/agencies";

import { db } from "@/db";
import { agencies, roles, user } from "@/db/schema";
import { posts } from "@/db/schema/posts";

/**
 * Recupera tutte le agenzie immobiliari registrate nel sistema.
 *
 * @returns Promise di array contenente tutte le agenzie ordinate per data creazione decrescente
 */
export async function getAllAgencies() {
  return db.select().from(agencies).orderBy(desc(agencies.createdAt));
}

/**
 * Recupera i dettagli completi di una singola agenzia tramite ID.
 *
 * @param id - Identificativo univoco dell'agenzia
 * @returns Promise dell'agenzia trovata o undefined se non esistente
 */
export async function getAgencyById(id: number) {
  const [agency] = await db.select().from(agencies).where(eq(agencies.id, id));
  return agency;
}

/**
 * Crea una nuova agenzia immobiliare nel sistema.
 *
 * @param agencyData - Dati dell'agenzia da inserire (managerId opzionale)
 * @returns Promise dell'agenzia creata con ID assegnato
 * @throws Rilancia errori del database dopo logging
 */
export async function createAgency(agencyData: AgenciesInsertSchema) {
  try {
    const [createdAgency] = await db.insert(agencies).values({
      ...agencyData,
      managerId: agencyData.managerId || null,
    }).returning();
    return createdAgency;
  }
  catch (error) {
    console.error("Errore nel repository createAgency:", error);
    throw error;
  }
}

/**
 * Aggiorna i dati di un'agenzia esistente, gestendo il cambio di manager.
 *
 * @param id - ID dell'agenzia da modificare
 * @param agencyData - Campi da aggiornare (aggiornamento parziale supportato)
 * @returns Promise dell'agenzia aggiornata con timestamp updatedAt automatico
 */
export async function updateAgency(id: number, agencyData: AgenciesUpdateSchema) {
  // Se viene aggiornato il managerId, gestisci il cambio di manager
  if ("managerId" in agencyData) {
    const [currentAgency] = await db.select().from(agencies).where(eq(agencies.id, id));

    // Se c'era un vecchio manager, resetta il suo hasCreatedAgency
    if (currentAgency?.managerId && currentAgency.managerId !== agencyData.managerId) {
      await db.update(user)
        .set({
          hasCreatedAgency: false,
          agencyId: null,
        })
        .where(eq(user.id, currentAgency.managerId));
    }

    // Se c'è un nuovo manager, imposta il suo hasCreatedAgency
    if (agencyData.managerId) {
      await db.update(user)
        .set({
          hasCreatedAgency: true,
          agencyId: id,
        })
        .where(eq(user.id, agencyData.managerId));
    }
  }

  const [updatedAgency] = await db
    .update(agencies)
    .set({ ...agencyData, updatedAt: new Date() })
    .where(eq(agencies.id, id))
    .returning();
  return updatedAgency;
}

/**
 * Elimina un'agenzia dal database e resetta hasCreatedAgency del manager.
 *
 * @param id - ID dell'agenzia da rimuovere
 * @returns Promise dell'agenzia eliminata (dati prima della cancellazione)
 */
export async function deleteAgency(id: number) {
  // Prima recupera l'agenzia per ottenere il managerId
  const [agency] = await db.select().from(agencies).where(eq(agencies.id, id));

  if (!agency) {
    throw new Error("Agenzia non trovata");
  }

  // Se l'agenzia ha un manager, resetta il suo hasCreatedAgency
  if (agency.managerId) {
    await db.update(user)
      .set({
        hasCreatedAgency: false,
        agencyId: null,
      })
      .where(eq(user.id, agency.managerId));
  }

  const [deletedAgency] = await db.delete(agencies).where(eq(agencies.id, id)).returning();
  return deletedAgency;
}

/**
 * Recupera tutti gli agenti immobiliari non ancora assegnati a nessuna agenzia.
 *
 * @returns Promise di array contenente agenti con ruolo 'agent' e agencyId nullo
 */
export async function getUnassignedAgents() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
    })
    .from(user)
    .innerJoin(roles, eq(user.roleId, roles.id))
    .where(
      and(
        eq(roles.name, "agent"),
        isNull(user.agencyId),
      ),
    )
    .orderBy(user.createdAt);
}

/**
 * Recupera tutte le agenzie con informazioni complete sul manager associato.
 *
 * @returns Promise di array con agenzia e dati manager (nome, email, telefono) tramite LEFT JOIN
 */
export async function getAgenciesWithManagers() {
  return db
    .select({
      agency: agencies,
      manager: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    })
    .from(agencies)
    .leftJoin(user, eq(agencies.managerId, user.id));
}

/**
 * Recupera la lista di tutti gli agenti che appartengono a una specifica agenzia.
 *
 * @param agencyId - ID dell'agenzia di cui recuperare gli agenti
 * @returns Promise di array con dettagli agenti (nome, email, telefono, data creazione)
 */
export async function getAgentsByAgencyId(agencyId: number) {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      agencyId: user.agencyId || null,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.agencyId, agencyId));
}

/**
 * Assegna un agente a un'agenzia e aggiorna tutti i suoi annunci con l'agencyId.
 *
 * @param userId - ID dell'utente agente da assegnare
 * @param agencyId - ID dell'agenzia di destinazione
 * @returns Promise con dati utente aggiornato, conteggio post modificati e lista post
 */
export async function assignAgentToAgency(userId: number, agencyId: number) {
  const [updatedUser] = await db
    .update(user)
    .set({ agencyId })
    .where(eq(user.id, userId))
    .returning();

  const updatedPosts = await db
    .update(posts)
    .set({ agencyId })
    .where(eq(posts.userId, userId))
    .returning({
      id: posts.id,
      title: posts.title,
      agencyId: posts.agencyId,
    });

  return {
    user: updatedUser,
    updatedPostsCount: updatedPosts.length,
    updatedPosts,
  };
}

/**
 * Rimuove un agente da un'agenzia e dissocia tutti i suoi annunci dall'agenzia.
 *
 * @param userId - ID dell'agente da rimuovere
 * @returns Promise con dati utente aggiornato e conteggio post disassociati
 */
export async function removeAgentFromAgency(userId: number) {
  const [updatedUser] = await db
    .update(user)
    .set({ agencyId: null })
    .where(eq(user.id, userId))
    .returning();

  const updatedPosts = await db
    .update(posts)
    .set({ agencyId: null })
    .where(eq(posts.userId, userId))
    .returning({
      id: posts.id,
      title: posts.title,
      agencyId: posts.agencyId,
    });

  return {
    user: updatedUser,
    updatedPostsCount: updatedPosts.length,
    updatedPosts,
  };
}

/**
 * Crea un'agenzia assegnando automaticamente il manager e marcando che ha creato la sua agenzia.
 *
 * @param agencyData - Dati dell'agenzia da creare
 * @param managerId - ID del manager che crea l'agenzia
 * @returns Promise dell'agenzia creata
 * @throws Errore se manager non trovato o ha già creato un'agenzia
 */
export async function createAgencyForManager(agencyData: AgenciesInsertSchema, managerId: number) {
  const [manager] = await db.select().from(user).where(eq(user.id, managerId));

  if (!manager) {
    throw new Error("Manager non trovato");
  }

  if (manager.hasCreatedAgency) {
    throw new Error("Il manager ha già creato un'agenzia");
  }

  try {
    const [createdAgency] = await db.insert(agencies).values({
      ...agencyData,
      managerId,
    }).returning();

    await db.update(user)
      .set({
        agencyId: createdAgency.id,
        hasCreatedAgency: true,
      })
      .where(eq(user.id, managerId));

    return createdAgency;
  }
  catch (error) {
    console.error("Errore durante la creazione dell'agenzia per manager:", error);
    throw error;
  }
}

/**
 * Verifica se un manager ha i requisiti per creare una nuova agenzia.
 *
 * @param managerId - ID del manager da verificare
 * @returns Promise di boolean (true se può creare, false se ha già creato o non esiste)
 */
export async function canManagerCreateAgency(managerId: number) {
  const [manager] = await db.select().from(user).where(eq(user.id, managerId));
  return manager && !manager.hasCreatedAgency;
}

/**
 * Recupera l'agenzia gestita da un manager specifico.
 *
 * @param managerId - ID del manager di cui cercare l'agenzia
 * @returns Promise dell'agenzia trovata o undefined
 */
export async function getAgencyByManagerId(managerId: number) {
  const [agency] = await db.select().from(agencies).where(eq(agencies.managerId, managerId));
  return agency;
}

/**
 * Recupera l'agenzia a cui appartiene un determinato agente.
 *
 * @param agentId - ID dell'agente di cui trovare l'agenzia
 * @returns Promise dell'agenzia associata o undefined se agente non assegnato
 */
export async function getAgencyByAgentId(agentId: number) {
  const [result] = await db
    .select({
      agency: agencies,
    })
    .from(agencies)
    .innerJoin(user, eq(agencies.id, user.agencyId))
    .where(eq(user.id, agentId));

  return result?.agency;
}
