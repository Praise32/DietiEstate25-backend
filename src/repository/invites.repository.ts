import { eq } from "drizzle-orm";

import { db } from "@/db";
import { invites } from "@/db/schema/invites";

/**
 * Crea un nuovo invito per registrazione utente con token univoco.
 *
 * @param data - Dati invito contenenti email destinatario, ruolo, token JWT, invitedBy e scadenza
 * @param data.email - Email del destinatario dell'invito
 * @param data.role - Ruolo da assegnare all'utente (admin/agent/customer)
 * @param data.token - Token JWT univoco per validazione invito
 * @param data.invitedBy - ID dell'utente che ha creato l'invito
 * @param data.expiresAt - Data di scadenza dell'invito
 * @param data.agencyId - ID dell'agenzia (opzionale, per agenti)
 * @returns Promise dell'invito creato con ID assegnato
 */
export async function createInvite(data: {
  email: string;
  role: string;
  token: string;
  invitedBy: number;
  expiresAt: Date;
  agencyId?: number;
}) {
  const [invite] = await db.insert(invites).values(data).returning();
  return invite;
}

/**
 * Recupera un invito tramite token univoco per validazione.
 *
 * @param token - Token JWT generato per l'invito
 * @returns Promise dell'invito trovato o undefined se token non valido
 */
export async function getInviteByToken(token: string) {
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.token, token));
  return invite;
}

/**
 * Marca un invito come utilizzato dopo registrazione completata.
 *
 * @param token - Token dell'invito da invalidare
 * @returns Promise void (previene riutilizzo dello stesso invito)
 */
export async function markInviteAsUsed(token: string) {
  await db
    .update(invites)
    .set({ used: true })
    .where(eq(invites.token, token));
}
