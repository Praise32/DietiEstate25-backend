import { eq, or } from "drizzle-orm";

import { db } from "@/db";
import { roles, user } from "@/db/schema";

/**
 * Recupera un utente completo con informazioni sul ruolo tramite ID.
 *
 * @param id - Identificativo univoco dell'utente
 * @returns Promise dell'utente con dati ruolo (LEFT JOIN) o undefined se non trovato
 */
export async function getUserById(id: number) {
  const [userFound] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: user.password,
      agencyId: user.agencyId,
      hasCreatedAgency: user.hasCreatedAgency,
      roleId: user.roleId,
      role: roles.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .leftJoin(roles, eq(user.roleId, roles.id))
    .where(eq(user.id, id));
  return userFound;
}

/**
 * Recupera un utente tramite indirizzo email.
 *
 * @param email - Indirizzo email univoco dell'utente
 * @returns Promise dell'utente con dati ruolo o undefined se non registrato
 */
export async function getUserByEmail(email: string) {
  const [userFound] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: user.password,
      agencyId: user.agencyId,
      hasCreatedAgency: user.hasCreatedAgency,
      roleId: user.roleId,
      role: roles.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .leftJoin(roles, eq(user.roleId, roles.id))
    .where(eq(user.email, email));
  return userFound;
}

/**
 * Recupera l'ID numerico di un ruolo tramite nome.
 *
 * @param roleName - Nome del ruolo (es: 'admin', 'manager', 'agent', 'customer')
 * @returns Promise dell'ID ruolo o null se il ruolo non esiste
 */
export async function getRoleId(roleName: string) {
  const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
  return role ? role.id : null;
}

/**
 * Ricerca un utente usando email, nome utente o numero di telefono.
 *
 * @param identifier - Stringa che può corrispondere a email, name o phone
 * @returns Promise dell'utente trovato o undefined (utile per login flessibile)
 */
export async function getUserByIdentifier(identifier: string) {
  const [userFound] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: user.password,
      roleId: user.roleId,
      agencyId: user.agencyId,
      hasCreatedAgency: user.hasCreatedAgency,
      role: roles.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .leftJoin(roles, eq(user.roleId, roles.id))
    .where(
      or(
        eq(user.email, identifier),
        eq(user.name, identifier),
        eq(user.phone, identifier),
      ),
    );
  return userFound;
}

/**
 * Crea un nuovo utente nel sistema arricchendo i dati con il nome del ruolo.
 *
 * @param userBody - Dati dell'utente da registrare (password già hashata)
 * @returns Promise dell'utente creato con proprietà 'role' aggiunta o null se fallisce
 */
export async function createUser(userBody: {
  name: string;
  email: string;
  phone: string;
  password: string;
  roleId: number;
  agencyId?: number | null;
  googleId?: string;
  hasCreatedAgency?: boolean;
}) {
  const [createdUser] = await db
    .insert(user)
    .values(userBody)
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      agencyId: user.agencyId,
      hasCreatedAgency: user.hasCreatedAgency,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

  if (createdUser) {
    const [roleRow] = await db.select().from(roles).where(eq(roles.id, createdUser.roleId));
    return { ...createdUser, role: roleRow?.name };
  }
  return null;
}

/**
 * Recupera tutti gli utenti registrati con informazioni sul ruolo associato.
 *
 * @returns Promise di array con tutti gli utenti e nome ruolo tramite LEFT JOIN
 */
export async function getAllUsersWithRoles() {
  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      role: roles.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .leftJoin(roles, eq(user.roleId, roles.id));
  return users;
}

/**
 * Aggiorna la password di un utente esistente.
 *
 * @param userId - ID dell'utente di cui modificare la password
 * @param newPassword - Nuova password (deve essere già hashata con bcrypt)
 * @returns Promise void (operazione di update)
 */
export async function updatePassword(userId: number, newPassword: string) {
  await db.update(user).set({ password: newPassword }).where(eq(user.id, userId));
}
