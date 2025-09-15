import { eq } from "drizzle-orm";

import { db } from "@/db";
import { invites } from "@/db/schema/invites";

export async function createInvite(data: {
  email: string;
  role: string;
  token: string;
  invitedBy: number;
  expiresAt: Date;
}) {
  const [invite] = await db.insert(invites).values(data).returning();
  return invite;
}

export async function getInviteByToken(token: string) {
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token));
  return invite;
}

export async function markInviteAsUsed(token: string) {
  await db
    .update(invites)
    .set({ used: true })
    .where(eq(invites.token, token));
}
