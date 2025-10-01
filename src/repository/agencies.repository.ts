import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { AgenciesInsertSchema, AgenciesUpdateSchema } from "@/db/schema/agencies";

import { db } from "@/db";
import { agencies, roles, user } from "@/db/schema";
import { posts } from "@/db/schema/posts";

// Recupera tutte le agenzie
export async function getAllAgencies() {
  return db.select().from(agencies).orderBy(desc(agencies.createdAt));
}

// Recupera un'agenzia specifica per ID
export async function getAgencyById(id: number) {
  const [agency] = await db.select().from(agencies).where(eq(agencies.id, id));
  return agency;
}

// Crea una nuova agenzia
export async function createAgency(agencyData: AgenciesInsertSchema) {
  try {
    const [createdAgency] = await db.insert(agencies).values({
      ...agencyData,
      managerId: agencyData.managerId || null, // Gestisci managerId opzionale
    }).returning();
    return createdAgency;
  }
  catch (error) {
    console.error("Errore nel repository createAgency:", error);
    throw error;
  }
}

// Aggiorna un'agenzia esistente
export async function updateAgency(id: number, agencyData: AgenciesUpdateSchema) {
  const [updatedAgency] = await db
    .update(agencies)
    .set({ ...agencyData, updatedAt: new Date() })
    .where(eq(agencies.id, id))
    .returning();
  return updatedAgency;
}

// Elimina un'agenzia
export async function deleteAgency(id: number) {
  const [deletedAgency] = await db.delete(agencies).where(eq(agencies.id, id)).returning();
  return deletedAgency;
}

// Recupera tutti gli agenti senza agenzia
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

// Recupera tutte le agenzie con i dettagli del manager
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

// Recupera tutti gli agenti di un'agenzia
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

// Assegna un agente a un'agenzia
export async function assignAgentToAgency(userId: number, agencyId: number) {
  // Aggiorna l'utente
  const [updatedUser] = await db
    .update(user)
    .set({ agencyId })
    .where(eq(user.id, userId))
    .returning();

  // Aggiorna tutti i post dell'agente con il nuovo agencyId
  const updatedPosts = await db
    .update(posts)
    .set({ agencyId })
    .where(eq(posts.userId, userId))
    .returning({
      id: posts.id,
      title: posts.title,
      agencyId: posts.agencyId,
    });

  // console.log(`Aggiornati ${updatedPosts.length} post per l'agente ${userId} con agencyId ${agencyId}`);

  return {
    user: updatedUser,
    updatedPostsCount: updatedPosts.length,
    updatedPosts,
  };
}

// Rimuove un agente da un'agenzia e rimuove l'agencyId dai suoi post
export async function removeAgentFromAgency(userId: number) {
  // Aggiorna l'utente
  const [updatedUser] = await db
    .update(user)
    .set({ agencyId: null })
    .where(eq(user.id, userId))
    .returning();

  // Rimuovi l'agencyId da tutti i post dell'agente
  const updatedPosts = await db
    .update(posts)
    .set({ agencyId: null })
    .where(eq(posts.userId, userId))
    .returning({
      id: posts.id,
      title: posts.title,
      agencyId: posts.agencyId,
    });

  // console.log(`Rimosso agencyId da ${updatedPosts.length} post per l'agente ${userId}`);

  return {
    user: updatedUser,
    updatedPostsCount: updatedPosts.length,
    updatedPosts,
  };
}

// Crea una nuova agenzia e marca il manager come avente creato l'agenzia
export async function createAgencyForManager(agencyData: AgenciesInsertSchema, managerId: number) {
  // Controlla se il manager ha già creato un'agenzia
  const [manager] = await db.select().from(user).where(eq(user.id, managerId));

  if (!manager) {
    throw new Error("Manager non trovato");
  }

  if (manager.hasCreatedAgency) {
    throw new Error("Il manager ha già creato un'agenzia");
  }

  try {
    // Crea l'agenzia
    const [createdAgency] = await db.insert(agencies).values({
      ...agencyData,
      managerId,
    }).returning();

    // Aggiorna il manager: associa all'agenzia e marca come avente creato l'agenzia
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

    // Se l'aggiornamento del manager fallisce, prova a eliminare l'agenzia creata
    // Nota: questo non è atomico come una transazione, ma è il meglio che possiamo fare con neon-http
    throw error;
  }
}

// Verifica se un manager può creare un'agenzia
export async function canManagerCreateAgency(managerId: number) {
  const [manager] = await db.select().from(user).where(eq(user.id, managerId));
  return manager && !manager.hasCreatedAgency;
}

// Recupera l'agenzia di un manager
export async function getAgencyByManagerId(managerId: number) {
  const [agency] = await db.select().from(agencies).where(eq(agencies.managerId, managerId));
  return agency;
}

// Recupera agenzia per agente ID
export async function getAgencyByAgentId(agentId: number) {
  const [result] = await db
    .select({
      agency: agencies,
    })
    .from(agencies)
    .innerJoin(sql`agency_users`, sql`agencies.id = agency_users.agency_id`)
    .where(sql`agency_users.user_id = ${agentId}`);

  return result?.agency;
}
