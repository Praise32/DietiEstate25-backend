import { db } from "../db/index.js";
import user from "../db/schema/user.js";
export async function createUser(userBody) {
    const [idUser] = await db.insert(user).values(userBody).returning({ id: user.id, name: user.name, email: user.email });
    return idUser;
}
