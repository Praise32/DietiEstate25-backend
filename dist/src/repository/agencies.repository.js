import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { agencies, roles, user } from "../db/schema/index.js";
import { posts } from "../db/schema/posts.js";
export async function getAllAgencies() {
    return db.select().from(agencies).orderBy(desc(agencies.createdAt));
}
export async function getAgencyById(id) {
    const [agency] = await db.select().from(agencies).where(eq(agencies.id, id));
    return agency;
}
export async function createAgency(agencyData) {
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
export async function updateAgency(id, agencyData) {
    const [updatedAgency] = await db
        .update(agencies)
        .set({ ...agencyData, updatedAt: new Date() })
        .where(eq(agencies.id, id))
        .returning();
    return updatedAgency;
}
export async function deleteAgency(id) {
    const [deletedAgency] = await db.delete(agencies).where(eq(agencies.id, id)).returning();
    return deletedAgency;
}
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
        .where(and(eq(roles.name, "agent"), isNull(user.agencyId)))
        .orderBy(user.createdAt);
}
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
export async function getAgentsByAgencyId(agencyId) {
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
export async function assignAgentToAgency(userId, agencyId) {
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
export async function removeAgentFromAgency(userId) {
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
export async function createAgencyForManager(agencyData, managerId) {
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
export async function canManagerCreateAgency(managerId) {
    const [manager] = await db.select().from(user).where(eq(user.id, managerId));
    return manager && !manager.hasCreatedAgency;
}
export async function getAgencyByManagerId(managerId) {
    const [agency] = await db.select().from(agencies).where(eq(agencies.managerId, managerId));
    return agency;
}
export async function getAgencyByAgentId(agentId) {
    const [result] = await db
        .select({
        agency: agencies,
    })
        .from(agencies)
        .innerJoin(user, eq(agencies.id, user.agencyId))
        .where(eq(user.id, agentId));
    return result?.agency;
}
