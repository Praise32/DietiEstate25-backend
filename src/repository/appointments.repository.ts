import { and, eq, sql} from "drizzle-orm";

import { db } from "@/db";
import { appointments, type AppointmentInsertSchema, type AppointmentStatusUpdateSchema } from "@/db/schema/appointments";
import { posts } from "@/db/schema/posts";
import user from "@/db/schema/user";

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
      user: {
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

// Recupero appuntamenti per un immobile
export async function getAppointmentsByPostId(postId: number) {
  return db
    .select()
    .from(appointments)
    .where(eq(appointments.postId, postId))
    .orderBy(appointments.requestedDate);
}

// Aggiornamento dello stato di un appuntamento
export async function updateAppointmentStatus(
  id: number, 
  agentId: number, 
  data: AppointmentStatusUpdateSchema
) {
  const [updated] = await db
    .update(appointments)
    .set({
      status: data.status,
      notes: data.notes,
      updatedAt: new Date(),
    })
    .where(and(
      eq(appointments.id, id),
      eq(appointments.agentId, agentId)
    ))
    .returning();
  
  return updated;
}

// Eliminazione di un appuntamento
export async function deleteAppointment(id: number, userId: number) {
  const [deleted] = await db
    .delete(appointments)
    .where(and(
      eq(appointments.id, id),
      eq(appointments.userId, userId)
    ))
    .returning();
  
  return deleted;
}


// Recupero appuntamenti per un agente in formato calendario
export async function getAppointmentsByAgentIdForCalendar(
  agentId: number,
  start?: Date,
  end?: Date
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
      agentName: sql`(SELECT name FROM users WHERE id = ${appointments.agentId})`.as('agent_name'),
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
  end?: Date
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
      agentName: sql`(SELECT name FROM users WHERE id = ${appointments.agentId})`.as('agent_name'),
    })
    .from(appointments)
    .innerJoin(posts, eq(appointments.postId, posts.id))
    .innerJoin(user, eq(appointments.agentId, user.id))
    .where(and(...conditions))
    .orderBy(appointments.requestedDate);
}