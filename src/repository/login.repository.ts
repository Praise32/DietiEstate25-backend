import type { SQL } from "drizzle-orm";

import { eq } from "drizzle-orm";

import type { UserInserSchema, UserSelectSchema } from "@/db/schema/user";

import { db } from "@/db";
import user from "@/db/schema/user";

export async function createUser(userBody: UserInserSchema) {
  const [idUser] = await db.insert(user).values(userBody).returning({ id: user.id, name: user.name, email: user.email });
  return idUser;
}

export async function getuser(userBody: UserSelectSchema) {
  let query: SQL<unknown>;

  if (userBody.name) {
    query = eq(user.name, userBody.name);
  }
  else if (userBody.email) {
    query = eq(user.email, userBody.email);
  }
  else {
    // Qua non entra mai ma lo sappiamo solo noi
    return null;
  }
  const [userFound] = await db
    .select({ password: user.password, id: user.id })
    .from(user)
    .where(query);
  return userFound;
}
