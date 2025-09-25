import { desc, eq, sql } from "drizzle-orm";

import type { AgenciesInsertSchema, AgenciesUpdateSchema } from "@/db/schema/agencies";

import { db } from "@/db";
import { agencies, user } from "@/db/schema";

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
  const [createdAgency] = await db.insert(agencies).values(agencyData).returning();
  return createdAgency;
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
  const [updatedUser] = await db
    .update(user)
    .set({ agencyId })
    .where(eq(user.id, userId))
    .returning();
  return updatedUser;
}

// Rimuove un agente da un'agenzia
export async function removeAgentFromAgency(userId: number) {
  const [updatedUser] = await db
    .update(user)
    .set({ agencyId: null })
    .where(eq(user.id, userId))
    .returning();
  return updatedUser;
}

// Crea una nuova agenzia e marca il manager come avente creato l'agenzia
export async function createAgencyForManager(agencyData: AgenciesInsertSchema, managerId: number) {
  return db.transaction(async (tx) => {
    // Controlla se il manager ha già creato un'agenzia
    const [manager] = await tx.select().from(user).where(eq(user.id, managerId));

    if (!manager) {
      throw new Error("Manager non trovato");
    }

    if (manager.hasCreatedAgency) {
      throw new Error("Il manager ha già creato un'agenzia");
    }

    // Crea l'agenzia
    const [createdAgency] = await tx.insert(agencies).values({
      ...agencyData,
      managerId,
    }).returning();

    // Aggiorna il manager: associa all'agenzia e marca come avente creato l'agenzia
    await tx.update(user)
      .set({
        agencyId: createdAgency.id,
        hasCreatedAgency: true,
      })
      .where(eq(user.id, managerId));

    return createdAgency;
  });
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
