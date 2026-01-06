import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { invites } from "../db/schema/invites.js";
export async function createInvite(data) {
    const [invite] = await db.insert(invites).values(data).returning();
    return invite;
}
export async function getInviteByToken(token) {
    const [invite] = await db
        .select()
        .from(invites)
        .where(eq(invites.token, token));
    return invite;
}
export async function markInviteAsUsed(token) {
    await db
        .update(invites)
        .set({ used: true })
        .where(eq(invites.token, token));
}
