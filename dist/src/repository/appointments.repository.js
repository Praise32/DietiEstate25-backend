import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { appointments } from "../db/schema/appointments.js";
import { posts } from "../db/schema/posts.js";
import user from "../db/schema/user.js";
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
        agent: sql `(
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
export async function getAppointmentsByAgencyId(agencyId) {
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
        agent: sql `(
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
export async function getAllAppointmentsForCalendar(start, end) {
    const conditions = [];
    if (start) {
        conditions.push(sql `${appointments.requestedDate} >= ${start}`);
    }
    if (end) {
        conditions.push(sql `${appointments.requestedDate} <= ${end}`);
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
        clientName: sql `(SELECT name FROM users WHERE id = ${appointments.userId})`.as("client_name"),
        agentName: sql `(SELECT name FROM users WHERE id = ${appointments.agentId})`.as("agent_name"),
        agentEmail: sql `(SELECT email FROM users WHERE id = ${appointments.agentId})`.as("agent_email"),
        agentPhone: sql `(SELECT phone FROM users WHERE id = ${appointments.agentId})`.as("agent_phone"),
    })
        .from(appointments)
        .innerJoin(posts, eq(appointments.postId, posts.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(appointments.requestedDate);
}
export async function getAppointmentsByAgencyIdForCalendar(agencyId, start, end) {
    const agentIds = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.agencyId, agencyId));
    if (agentIds.length === 0) {
        return [];
    }
    const conditions = [inArray(appointments.agentId, agentIds.map(a => a.id))];
    if (start) {
        conditions.push(sql `${appointments.requestedDate} >= ${start}`);
    }
    if (end) {
        conditions.push(sql `${appointments.requestedDate} <= ${end}`);
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
        clientName: sql `(SELECT name FROM users WHERE id = ${appointments.userId})`.as("client_name"),
        agentName: sql `(SELECT name FROM users WHERE id = ${appointments.agentId})`.as("agent_name"),
        agentEmail: sql `(SELECT email FROM users WHERE id = ${appointments.agentId})`.as("agent_email"),
        agentPhone: sql `(SELECT phone FROM users WHERE id = ${appointments.agentId})`.as("agent_phone"),
    })
        .from(appointments)
        .innerJoin(posts, eq(appointments.postId, posts.id))
        .where(and(...conditions))
        .orderBy(appointments.requestedDate);
}
export async function createAppointment(data) {
    const [appointment] = await db
        .insert(appointments)
        .values(data)
        .returning();
    return appointment;
}
export async function getAppointmentById(id) {
    const [appointment] = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, id));
    return appointment;
}
export async function getAppointmentsByUserId(userId) {
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
export async function getAppointmentsByAgentId(agentId) {
    const result = await db
        .select({
        appointment: appointments,
        post: {
            id: posts.id,
            title: posts.title,
            address: posts.address,
            city: posts.city,
        },
        client: {
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
export async function updateAppointmentStatus(id, userId, data, userRole) {
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
export async function deleteAppointment(id, userId, userRole) {
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
export async function getAppointmentsByAgentIdForCalendar(agentId, start, end) {
    const conditions = [eq(appointments.agentId, agentId)];
    if (start) {
        conditions.push(sql `${appointments.requestedDate} >= ${start}`);
    }
    if (end) {
        conditions.push(sql `${appointments.requestedDate} <= ${end}`);
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
        agentName: sql `(SELECT name FROM users WHERE id = ${appointments.agentId})`.as("agent_name"),
    })
        .from(appointments)
        .innerJoin(posts, eq(appointments.postId, posts.id))
        .innerJoin(user, eq(appointments.userId, user.id))
        .where(and(...conditions))
        .orderBy(appointments.requestedDate);
}
export async function getAppointmentsByUserIdForCalendar(userId, start, end) {
    const conditions = [eq(appointments.userId, userId)];
    if (start) {
        conditions.push(sql `${appointments.requestedDate} >= ${start}`);
    }
    if (end) {
        conditions.push(sql `${appointments.requestedDate} <= ${end}`);
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
        agentName: sql `(SELECT name FROM users WHERE id = ${appointments.agentId})`.as("agent_name"),
    })
        .from(appointments)
        .innerJoin(posts, eq(appointments.postId, posts.id))
        .innerJoin(user, eq(appointments.agentId, user.id))
        .where(and(...conditions))
        .orderBy(appointments.requestedDate);
}
export async function rescheduleAppointment(id, newDate, notes) {
    const updateData = {
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
export async function getOccupiedSlots(filters) {
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
        conditions.push(sql `${appointments.requestedDate} >= ${filters.start}`);
    }
    if (filters.end) {
        conditions.push(sql `${appointments.requestedDate} <= ${filters.end}`);
    }
    return db
        .select({
        requestedDate: appointments.requestedDate,
    })
        .from(appointments)
        .where(and(...conditions));
}
