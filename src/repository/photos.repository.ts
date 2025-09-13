import { eq } from "drizzle-orm";

import type { PhotoInsertSchemaType } from "@/db/schema/photo";

import { db } from "@/db";
import { photos } from "@/db/schema/photo";

export async function createPhoto(photoBody: PhotoInsertSchemaType) {
  const [photo] = await db.insert(photos).values(photoBody).returning();
  return photo;
}

export async function getPhotoById(id: number) {
  const [photo] = await db.select().from(photos).where(eq(photos.id, id));
  return photo;
}

export async function deletePhoto(id: number) {
  return await db.delete(photos).where(eq(photos.id, id)).returning();
}

export async function getAllPhotoByPostId(id: number) {
  const photo = await db.select().from(photos).where(eq(photos.postsId, id));
  return photo;
}
