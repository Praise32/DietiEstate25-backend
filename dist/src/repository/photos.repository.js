import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { photos } from "../db/schema/photo.js";
export async function createPhoto(photoBody) {
    const [photo] = await db.insert(photos).values(photoBody).returning();
    return photo;
}
export async function getPhotoById(id) {
    const [photo] = await db.select().from(photos).where(eq(photos.id, id));
    return photo;
}
export async function deletePhoto(id) {
    const deletedPhotos = await db.delete(photos).where(eq(photos.id, id)).returning();
    return deletedPhotos;
}
export async function getAllPhotoByPostId(id) {
    const photo = await db.select().from(photos).where(eq(photos.postsId, id));
    return photo;
}
