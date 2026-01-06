import { getPresignedUrl } from "../api/middleware/photo.middleware.js";
import * as photoRepository from "../repository/photos.repository.js";
export async function enrichPostWithPhotos(post) {
    const photos = await photoRepository.getAllPhotoByPostId(post.id);
    const photosWithUrls = await enrichPhotosWithUrls(photos);
    return { ...post, photos: photosWithUrls };
}
export async function enrichPhotosWithUrls(photos) {
    return Promise.all(photos.map(async (photo) => ({
        ...photo,
        url: await getPresignedUrl(photo.filename),
    })));
}
