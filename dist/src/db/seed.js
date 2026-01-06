import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import user, { roles } from "../db/schema/user.js";
export async function seedAdmin() {
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, "admin"));
    const [admin] = await db.select().from(user).where(eq(user.email, "admin@dietiestates.com"));
    if (!admin && adminRole) {
        await db.insert(user).values({
            name: "Admin",
            email: "admin@dietiestates.com",
            phone: "0000000000",
            password: bcrypt.hashSync("admin123", 10),
            roleId: adminRole.id,
        });
    }
}
const defaultRoles = ["admin", "support", "manager", "agent", "customer"];
export async function seedRoles() {
    for (const roleName of defaultRoles) {
        const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
        if (!role) {
            await db.insert(roles).values({ name: roleName });
        }
    }
}
