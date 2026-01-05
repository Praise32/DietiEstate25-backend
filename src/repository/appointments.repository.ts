import { and, eq, inArray, sql } from "drizzle-orm";

import type { AppointmentInsertSchema, AppointmentStatusUpdateSchema } from "@/db/schema/appointments";

import { db } from "@/db";
import { appointments } from "@/db/schema/appointments";
import { posts } from "@/db/schema/posts";
import user from "@/db/schema/user";

// Recupero di tutti gli appuntamenti (per admin e support) - AGGIORNATO
export async function getAllAppointments() {
  const result = await db
    .select({
      appointment: appointments,
      post: {
        id: posts.id,
        title: posts.title,
        address: posts.address,
        city: posts.city,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      // Aggiungi i dati completi dell'agente con una subquery
      agent: sql`(
        SELECT json_build_object(
          'id', id,
          'name', name,
          'email', email,
          'phone', phone
        ) FROM users WHERE id = ${appointments.agentId}
      )`.as("agent"),
    })
    .from(appointments)
    .innerJoin(posts, eq(appointments.postId, posts.id))
    .innerJoin(user, eq(appointments.userId, user.id))
    .orderBy(appointments.requestedDate);

  return result;
}

// Recupero appuntamenti per agenzia (per manager)
export async function getAppointmentsByAgencyId(agencyId: number) {
  // Recupera gli agenti dell'agenzia usando il campo agencyId direttamente
  const agentIds = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.agencyId, agencyId));

  if (agentIds.length === 0) {
    return [];
  }

  const result = await db
    .select({
      appointment: appointments,
      post: {
        id: posts.id,
        title: posts.title,
        address: posts.address,
        city: posts.city,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      // Aggiungi i dati completi dell'agente con una subquery
      agent: sql`(
        SELECT json_build_object(
          'id', id,
          'name', name,
          'email', email,
          'phone', phone
        ) FROM users WHERE id = ${appointments.agentId}
      )`.as("agent"),
    })
    .from(appointments)
    .where(inArray(appointments.agentId, agentIds.map(a => a.id)))
    .innerJoin(posts, eq(appointments.postId, posts.id))
    .innerJoin(user, eq(appointments.userId, user.id))
    .orderBy(appointments.requestedDate);

  return result;
}

// Recupero tutti gli appuntamenti in formato calendario (per admin e support) - AGGIORNATO
export async function getAllAppointmentsForCalendar(start?: Date, end?: Date) {
  const conditions = [];

  if (start) {
    conditions.push(sql`${appointments.requestedDate} >= ${start}`);
  }

  if (end) {
    conditions.push(sql`${appointments.requestedDate} <= ${end}`);
  }

  return db
    .select({
      id: appointments.id,
      requestedDate: appointments.requestedDate,
      status: appointments.status,
      notes: appointments.notes,
      postId: appointments.postId,
      postTitle: posts.title,
      address: posts.address,
      clientName: sql`(SELECT name FROM users WHERE id = ${appointments.userId})`.as("client_name"),
      agentName: sql`(SELECT name FROM users WHERE id = ${appointments.agentId})`.as("agent_name"),
      agentEmail: sql`(SELECT email FROM users WHERE id = ${appointments.agentId})`.as("agent_email"),
      agentPhone: sql`(SELECT phone FROM users WHERE id = ${appointments.agentId})`.as("agent_phone"),
    })
    .from(appointments)
    .innerJoin(posts, eq(appointments.postId, posts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(appointments.requestedDate);
}

// Recupero appuntamenti per agenzia in formato calendario (per manager) - AGGIORNATO
export async function getAppointmentsByAgencyIdForCalendar(
  agencyId: number,
  start?: Date,
  end?: Date,
) {
  // Recupera gli agenti dell'agenzia usando il campo agencyId direttamente
  const agentIds = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.agencyId, agencyId)); // Usa il campo agencyId direttamente

  if (agentIds.length === 0) {
    return [];
  }

  const conditions = [inArray(appointments.agentId, agentIds.map(a => a.id))];

  if (start) {
    conditions.push(sql`${appointments.requestedDate} >= ${start}`);
  }

  if (end) {
    conditions.push(sql`${appointments.requestedDate} <= ${end}`);
  }

  return db
    .select({
      id: appointments.id,
      requestedDate: appointments.requestedDate,
      status: appointments.status,
      notes: appointments.notes,
      postId: appointments.postId,
      postTitle: posts.title,
      address: posts.address,
      clientName: sql`(SELECT name FROM users WHERE id = ${appointments.userId})`.as("client_name"),
      agentName: sql`(SELECT name FROM users WHERE id = ${appointments.agentId})`.as("agent_name"),
      agentEmail: sql`(SELECT email FROM users WHERE id = ${appointments.agentId})`.as("agent_email"),
      agentPhone: sql`(SELECT phone FROM users WHERE id = ${appointments.agentId})`.as("agent_phone"),
    })
    .from(appointments)
    .innerJoin(posts, eq(appointments.postId, posts.id))
    .where(and(...conditions))
    .orderBy(appointments.requestedDate);
}

// Creazione di un nuovo appuntamento
export async function createAppointment(data: AppointmentInsertSchema) {
  const [appointment] = await db
    .insert(appointments)
    .values(data)
    .returning();
  return appointment;
}

// Recupero di un appuntamento per ID
export async function getAppointmentById(id: number) {
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, id));
  return appointment;
}

// Recupero appuntamenti per un utente (cliente)
export async function getAppointmentsByUserId(userId: number) {
  const result = await db
    .select({
      appointment: appointments,
      post: {
        id: posts.id,
        title: posts.title,
        address: posts.address,
        city: posts.city,
      },
      agent: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    })
    .from(appointments)
    .where(eq(appointments.userId, userId))
    .innerJoin(posts, eq(appointments.postId, posts.id))
    .innerJoin(user, eq(appointments.agentId, user.id))
    .orderBy(appointments.requestedDate);

  return result;
}

// Recupero appuntamenti per un agente
export async function getAppointmentsByAgentId(agentId: number) {
  const result = await db
    .select({
      appointment: appointments,
      post: {
        id: posts.id,
        title: posts.title,
        address: posts.address,
        city: posts.city,
      },
      client: { // Rinomina da 'user' a 'client' per chiarezza
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    })
    .from(appointments)
    .where(eq(appointments.agentId, agentId))
    .innerJoin(posts, eq(appointments.postId, posts.id))
    .innerJoin(user, eq(appointments.userId, user.id))
    .orderBy(appointments.requestedDate);

  return result;
}

// Aggiornamento dello stato di un appuntamento
export async function updateAppointmentStatus(
  id: number,
  userId: number,
  data: AppointmentStatusUpdateSchema,
  userRole: string,
) {
  // Per gli agenti, verifica che sia il loro appuntamento
  // Per admin, support e manager, la verifica è già stata fatta nel router
  const conditions = [eq(appointments.id, id)];

  if (userRole === "agent") {
    conditions.push(eq(appointments.agentId, userId));
  }

  const [updated] = await db
    .update(appointments)
    .set({
      status: data.status,
      notes: data.notes,
      updatedAt: new Date(),
    })
    .where(and(...conditions))
    .returning();

  return updated;
}

// Eliminazione di un appuntamento
export async function deleteAppointment(id: number, userId: number, userRole: string) {
  // Per i clienti, verifica che sia il loro appuntamento
  // Per admin e manager, la verifica è già stata fatta nel router
  const conditions = [eq(appointments.id, id)];

  if (userRole === "customer") {
    conditions.push(eq(appointments.userId, userId));
  }

  const [deleted] = await db
    .delete(appointments)
    .where(and(...conditions))
    .returning();

  return deleted;
}

// Recupero appuntamenti per un agente in formato calendario
export async function getAppointmentsByAgentIdForCalendar(
  agentId: number,
  start?: Date,
  end?: Date,
) {
  const conditions = [eq(appointments.agentId, agentId)];

  // Applica filtri di data se specificati
  if (start) {
    conditions.push(sql`${appointments.requestedDate} >= ${start}`);
  }

  if (end) {
    conditions.push(sql`${appointments.requestedDate} <= ${end}`);
  }

  return db
    .select({
      id: appointments.id,
      requestedDate: appointments.requestedDate,
      status: appointments.status,
      notes: appointments.notes,
      postId: appointments.postId,
      postTitle: posts.title,
      address: posts.address,
      clientName: user.name,
      agentName: sql`(SELECT name FROM users WHERE id = ${appointments.agentId})`.as("agent_name"),
    })
    .from(appointments)
    .innerJoin(posts, eq(appointments.postId, posts.id))
    .innerJoin(user, eq(appointments.userId, user.id))
    .where(and(...conditions))
    .orderBy(appointments.requestedDate);
}

// Recupero appuntamenti per un utente in formato calendario
export async function getAppointmentsByUserIdForCalendar(
  userId: number,
  start?: Date,
  end?: Date,
) {
  const conditions = [eq(appointments.userId, userId)];

  // Applica filtri di data se specificati
  if (start) {
    conditions.push(sql`${appointments.requestedDate} >= ${start}`);
  }

  if (end) {
    conditions.push(sql`${appointments.requestedDate} <= ${end}`);
  }

  return db
    .select({
      id: appointments.id,
      requestedDate: appointments.requestedDate,
      status: appointments.status,
      notes: appointments.notes,
      postId: appointments.postId,
      postTitle: posts.title,
      address: posts.address,
      clientName: user.name,
      agentName: sql`(SELECT name FROM users WHERE id = ${appointments.agentId})`.as("agent_name"),
    })
    .from(appointments)
    .innerJoin(posts, eq(appointments.postId, posts.id))
    .innerJoin(user, eq(appointments.agentId, user.id))
    .where(and(...conditions))
    .orderBy(appointments.requestedDate);
}

// Riprogrammazione appuntamento
export async function rescheduleAppointment(id: number, newDate: Date, notes?: string) {
  const updateData: { requestedDate: Date; notes?: string; updatedAt: Date } = {
    requestedDate: newDate,
    updatedAt: new Date(),
  };

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  const [updated] = await db
    .update(appointments)
    .set(updateData)
    .where(eq(appointments.id, id))
    .returning();

  return updated;
}

// Recupero solo gli slot occupati (pubblico/leggero)
export async function getOccupiedSlots(filters: { agentId?: number; postId?: number; start?: Date; end?: Date }) {
  const conditions = [
    inArray(appointments.status, ["pending", "confirmed"]),
  ];

  if (filters.agentId) {
    conditions.push(eq(appointments.agentId, filters.agentId));
  }
  if (filters.postId) {
    conditions.push(eq(appointments.postId, filters.postId));
  }
  if (filters.start) {
    conditions.push(sql`${appointments.requestedDate} >= ${filters.start}`);
  }
  if (filters.end) {
    conditions.push(sql`${appointments.requestedDate} <= ${filters.end}`);
  }

  return db
    .select({
      requestedDate: appointments.requestedDate,
    })
    .from(appointments)
    .where(and(...conditions));
}
