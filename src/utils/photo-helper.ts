import { getPresignedUrl } from "@/api/middleware/photo.middleware";
import * as photoRepository from "@/repository/photos.repository";

export interface PhotoWithUrl {
  id: number;
  url: string;
  filename: string;
  userId: number;
  postsId: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Arricchisce un post con le sue foto complete di URL S3 presigned.
 *
 * @param post - L'entità post da arricchire (deve contenere almeno l'ID)
 * @returns Promise dell'oggetto post originale con proprietà `photos` contenente array di foto con URL temporanei
 * @throws Potrebbe propagare errori dal repository o dalla generazione degli URL S3
 */
export async function enrichPostWithPhotos<T extends { id: number }>(
  post: T,
): Promise<T & { photos: PhotoWithUrl[] }> {
  const photos = await photoRepository.getAllPhotoByPostId(post.id);
  const photosWithUrls = await enrichPhotosWithUrls(photos);
  return { ...post, photos: photosWithUrls };
}

/**
 * Trasforma un array di foto aggiungendo URL S3 presigned temporanei.
 *
 * @param photos - Array di oggetti foto con almeno la proprietà `filename`
 * @returns Promise di array di foto complete con URL accessibili pubblicamente (validità temporanea AWS)
 */
export async function enrichPhotosWithUrls(
  photos: Array<{ filename: string; [key: string]: unknown }>,
): Promise<PhotoWithUrl[]> {
  return Promise.all(
    photos.map(async photo => ({
      ...photo,
      url: await getPresignedUrl(photo.filename),
    })) as Promise<PhotoWithUrl>[],
  );
}
