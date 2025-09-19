import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { agencies, user } from "@/db/schema";
import type { AgenciesInsertSchema, AgenciesUpdateSchema } from "@/db/schema/agencies";

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
export async function createAgency(agencyData:  AgenciesInsertSchema) {
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