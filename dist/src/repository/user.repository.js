import { eq, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { roles, user } from "../db/schema/index.js";
export async function getUserById(id) {
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
export async function getUserByEmail(email) {
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
export async function getRoleId(roleName) {
    const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
    return role ? role.id : null;
}
export async function getUserByIdentifier(identifier) {
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
        .where(or(eq(user.email, identifier), eq(user.name, identifier), eq(user.phone, identifier)));
    return userFound;
}
export async function createUser(userBody) {
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
export async function updatePassword(userId, newPassword) {
    await db.update(user).set({ password: newPassword }).where(eq(user.id, userId));
}
