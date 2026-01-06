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

export async function enrichPostWithPhotos<T extends { id: number }>(
  post: T,
): Promise<T & { photos: PhotoWithUrl[] }> {
  const photos = await photoRepository.getAllPhotoByPostId(post.id);
  const photosWithUrls = await enrichPhotosWithUrls(photos);
  return { ...post, photos: photosWithUrls };
}

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
