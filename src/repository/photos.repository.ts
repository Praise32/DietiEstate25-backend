import { eq } from "drizzle-orm";

import type { PhotoInsertSchemaType } from "@/db/schema/photo";

import { db } from "@/db";
import { photos } from "@/db/schema/photo";

/**
 * Carica una nuova foto associata a un annuncio immobiliare.
 *
 * @param photoBody - Dati foto contenenti filename, userId e postsId
 * @returns Promise della foto creata con ID e timestamp assegnati
 */
export async function createPhoto(photoBody: PhotoInsertSchemaType) {
  const [photo] = await db.insert(photos).values(photoBody).returning();
  return photo;
}

/**
 * Recupera una singola foto tramite identificativo.
 *
 * @param id - ID univoco della foto
 * @returns Promise della foto trovata o undefined
 */
export async function getPhotoById(id: number) {
  const [photo] = await db.select().from(photos).where(eq(photos.id, id));
  return photo;
}

/**
 * Elimina una foto dal database (non rimuove file da S3).
 *
 * @param id - ID della foto da eliminare
 * @returns Promise della foto eliminata (array di foto cancellate)
 */
export async function deletePhoto(id: number) {
  const deletedPhotos = await db.delete(photos).where(eq(photos.id, id)).returning();
  return deletedPhotos;
}

/**
 * Recupera tutte le foto associate a uno specifico annuncio immobiliare.
 *
 * @param id - ID del post di cui recuperare le foto
 * @returns Promise di array contenente tutte le foto del post
 */
export async function getAllPhotoByPostId(id: number) {
  const photo = await db.select().from(photos).where(eq(photos.postsId, id));
  return photo;
}
