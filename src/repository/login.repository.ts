import type { UserInserSchema } from "@/db/schema/user";

import { db } from "@/db";
import user from "@/db/schema/user";

export async function createUser(userBody: UserInserSchema) {
  const [idUser] = await db.insert(user).values(userBody).returning({ id: user.id, name: user.name, email: user.email });
  return idUser;
}
