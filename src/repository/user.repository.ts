import { eq , or} from "drizzle-orm";

import { db } from "@/db";
import { user, roles } from "@/db/schema";

export async function getUserById(id: number) {
  const [userFound] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: user.password,
      agencyId: user.agencyId,
      roleId: user.roleId,
      role: roles.name, // <-- nome del ruolo
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .leftJoin(roles, eq(user.roleId, roles.id))
    .where(eq(user.id, id));
  return userFound;
}

export async function getRoleId(roleName: string) {
  const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
  return role ? role.id : null;
}

export async function getUserByIdentifier(identifier: string) {
  const [userFound] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: user.password,
      roleId: user.roleId,
      role: roles.name, // <-- nome del ruolo
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .leftJoin(roles, eq(user.roleId, roles.id))
    .where(
      or(
        eq(user.email, identifier),
        eq(user.name, identifier),
        eq(user.phone, identifier)
      )
    );
  return userFound;
}

export async function createUser(userBody: {
  name: string;
  email: string;
  phone: string;
  password: string;
  roleId: number;
  googleId?: string;
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
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

  // Recupera anche il nome del ruolo
  if (createdUser) {
    const [roleRow] = await db.select().from(roles).where(eq(roles.id, createdUser.roleId));
    return { ...createdUser, role: roleRow?.name };
  }
  return null;
}

// Restituisce tutti gli utenti con il nome del ruolo associato
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


export async function updatePassword(userId: number, newPassword: string) {
  await db.update(user).set({ password: newPassword }).where(eq(user.id, userId));
}