import type { Request, RequestHandler, Response } from "express";

import { eq } from "drizzle-orm";
import express from "express";
import validate from "express-zod-safe";
import { z } from "zod";

import { deleteFileFromS3, getPresignedUrl, upload } from "@/api/middleware/photo.middleware";
import { db } from "@/db";
import {
  postIdSchema,
  postInsertSchema,
  posts,
  postUpdateSchema,
  searchFiltersSchema,
} from "@/db/schema/posts";
import * as photoRepository from "@/repository/photos.repository";
import * as postsRepository from "@/repository/posts.repository";
import * as userRepository from "@/repository/user.repository";
import passport from "@/utils/passport";
import { formatWeatherData, getWeatherForecast } from "@/utils/weather-service";

import { authMiddleware, isOwnerMiddlewarePosts } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/:id", validate({ params: postIdSchema }), async (req, res) => {
  const foundPost = await postsRepository.getPostById(req.params.id);
  if (!foundPost) {
    res.status(404).end();
    return;
  }

  const author = await userRepository.getUserById(foundPost.userId);

  if (!author) {
    res.status(404).json({ message: "Autore non trovato." });
    return;
  }

  // Recupera tutte le foto del post
  const photos = await photoRepository.getAllPhotoByPostId(foundPost.id);
  // Genera i presigned URL per tutte le foto
  const photosWithUrls = await Promise.all(
    photos.map(async photo => ({
      ...photo,
      url: await getPresignedUrl(photo.filename),
    })),
  );
  res.json({ ...foundPost, photos: photosWithUrls, author });
});

router.get("/", (async (req: Request, res: Response) => {
  const validation = searchFiltersSchema.safeParse(req.query);

  if (!validation.success) {
    res.status(400).json({ errors: validation.error.issues });
    return;
  }

  const filters = validation.data;

  try {
    let posts;
    let total;

    const { page, limit, latitude, longitude, radius, ...otherFilters } = filters;

    if (latitude !== undefined && longitude !== undefined && radius !== undefined) {
      const hasOtherFilters = Object.values(otherFilters).some(value => value !== undefined);

      if (hasOtherFilters) {
        posts = await postsRepository.getPostsNearbyWithFilters(
          latitude,
          longitude,
          radius,
          otherFilters,
          page,
          limit,
        );

        total = await postsRepository.countPostsNearbyWithFilters(
          latitude,
          longitude,
          radius,
          otherFilters,
        );
      }
      else {
        posts = await postsRepository.getPostsNearby(
          latitude,
          longitude,
          radius,
          page,
          limit,
        );

        total = await postsRepository.countPostsNearby(
          latitude,
          longitude,
          radius,
        );
      }
    }
    else {
      posts = await postsRepository.getAllPosts(filters);
      total = await postsRepository.countAllPosts(otherFilters);
    }

    const postsWithPhotos = await Promise.all(
      posts.map(async (post) => {
        const photos = await photoRepository.getAllPhotoByPostId(post.id);
        const photosWithUrls = await Promise.all(
          photos.map(async photo => ({
            ...photo,
            url: await getPresignedUrl(photo.filename),
          })),
        );
        return { ...post, photos: photosWithUrls };
      }),
    );

    const response: {
      data: typeof postsWithPhotos;
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      searchCenter?: { latitude: number; longitude: number };
      searchRadius?: number;
      searchType: string;
    } = {
      data: postsWithPhotos,
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
      searchType: "standard",
    };

    if (latitude !== undefined && longitude !== undefined && radius !== undefined) {
      response.searchCenter = { latitude, longitude };
      response.searchRadius = radius;
      response.searchType = "nearby";
    }

    res.status(200).json(response);
  }
  catch (error) {
    console.error("Errore durante la ricerca dei post:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
}) as RequestHandler);

router.post("/", passport.authenticate("jwt", { session: false }), validate({ body: postInsertSchema }), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Utente non autenticato" });
      return;
    }

    const user = await userRepository.getUserById(userId);

    if (!user) {
      res.status(404).json({ message: "Utente non trovato" });
      return;
    }

    const postInsert = await postsRepository.createPost({
      ...req.body,
      userId,
      agencyId: user.agencyId || null,
    });

    res.status(201).json(postInsert);
  }
  catch (error) {
    if (error instanceof Error && error.message.includes("geocodificare")) {
      res.status(400).json({
        message: "Indirizzo non valido o non trovato. Verifica che via, città e CAP siano corretti.",
        details: error.message,
      });
      return;
    }

    console.error("Errore durante la creazione del post:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
});

// Elimina un post - Può essere eliminato da: proprietario, manager dell'agenzia, admin, support
router.delete("/:id", passport.authenticate("jwt", { session: false }), isOwnerMiddlewarePosts, async (req, res) => {
  const deletePost = postIdSchema.safeParse(req.params);
  if (deletePost.error || !deletePost.data) {
    res.status(400).json(deletePost.error);
    return;
  }
  const Photo = await photoRepository.getAllPhotoByPostId(deletePost.data.id);

  if (Photo && Array.isArray(Photo)) {
    for (const photo of Photo) {
      await deleteFileFromS3(photo.filename);
    }
  }

  const Post = await postsRepository.deletePost(deletePost.data.id);
  if (!Post) {
    res.status(404).end();
    return;
  }

  res.json(Post);
});

// Modifica un post - Può essere modificato da: proprietario, manager dell'agenzia, admin, support
router.put("/:id", authMiddleware, isOwnerMiddlewarePosts, async (req, res) => {
  const putID = postIdSchema.safeParse(req.params);
  if (putID.error || !putID.data) {
    res.status(400).json(putID.error);
    return;
  }

  const putBody = postUpdateSchema.safeParse(req.body);
  if (putBody.error || !putBody.data) {
    res.status(400).json(putBody.error);
    return;
  }

  const postId = req.posts?.id;
  if (!postId) {
    res.status(404).json({ message: "Post non trovato" });
    return;
  }

  const updatedPost = await postsRepository.updatePost(postId, putBody.data);
  if (!updatedPost) {
    res.status(404).end();
    return;
  }

  res.json(updatedPost);
});

router.post("/:id/upload", authMiddleware, isOwnerMiddlewarePosts, upload.array("imageFiles", 5), async (req, res) => {
  if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
    res.status(400).json({ message: "Nessun file caricato." });
    return;
  }

  const userId = req.user?.id;
  const postId = req.posts?.id;

  if (!userId || !postId) {
    res.status(401).json({ message: "Utente o post non trovato" });
    return;
  }

  const filesS3 = req.files as Express.MulterS3.File[];
  const uploadedFiles = filesS3.map(file => ({
    url: file.location,
    fileName: file.key,
    bucket: file.bucket,
    mimetype: file.contentType,
    size: file.size,
  }));

  const photos = [];
  for (const file of uploadedFiles) {
    const photo = await photoRepository.createPhoto({
      url: file.url,
      filename: file.fileName,
      userId,
      postsId: postId,
    });
    photos.push(photo);
  }
  res.status(201).json(photos);
});

// Helper function per verificare autorizzazione eliminazione foto
async function checkPhotoDeleteAuthorization(
  currentUser: Express.User,
  photo: { userId: number },
  post: { userId: number; agencyId: number | null },
): Promise<boolean> {
  // Admin e Support possono eliminare qualsiasi foto
  if (currentUser.role === "admin" || currentUser.role === "support") {
    return true;
  }

  // Il proprietario della foto può eliminarla
  if (photo.userId === currentUser.id) {
    return true;
  }

  // Il proprietario del post può eliminare le foto
  if (post.userId === currentUser.id) {
    return true;
  }

  // Manager può eliminare foto dei post della propria agenzia
  if (currentUser.role === "manager" && post.agencyId !== null && currentUser.id) {
    const agenciesRepository = await import("@/repository/agencies.repository");
    const managerAgency = await agenciesRepository.getAgencyByManagerId(currentUser.id);
    return !!(managerAgency && managerAgency.id === post.agencyId);
  }

  return false;
}

router.delete("/photos/:id", passport.authenticate("jwt", { session: false }), async (req, res) => {
  const photoId = Number(req.params.id);
  if (Number.isNaN(photoId)) {
    res.status(400).json({ message: "ID foto non valido." });
    return;
  }

  const photo = await photoRepository.getPhotoById(photoId);
  if (!photo) {
    res.status(404).json({ message: "Foto non trovata." });
    return;
  }

  const post = await postsRepository.getPostById(photo.postsId);
  if (!post) {
    res.status(404).json({ message: "Post non trovato." });
    return;
  }

  const currentUser = req.user;
  if (!currentUser) {
    res.status(401).json({ message: "Utente non autenticato" });
    return;
  }

  const isAuthorized = await checkPhotoDeleteAuthorization(currentUser, photo, post);

  if (!isAuthorized) {
    res.status(403).json({ message: "Non sei autorizzato a eliminare questa foto." });
    return;
  }

  const deleted = await photoRepository.deletePhoto(photoId);
  if (!deleted) {
    res.status(500).json({ message: "Errore durante l'eliminazione della foto dal database." });
    return;
  }

  try {
    await deleteFileFromS3(photo.filename);
  }
  catch (err) {
    console.error("Errore durante l'eliminazione da S3:", err);
  }

  res.status(200).json({ message: "Foto eliminata con successo." });
});

const weatherQuerySchema = z.object({
  days: z.coerce.number().min(1).max(16).default(7),
  latitude: z.coerce.number().min(-90).max(90), // Ora obbligatorio
  longitude: z.coerce.number().min(-180).max(180), // Ora obbligatorio
});

// Ottieni previsioni meteo per un immobile (con coordinate obbligatorie dal frontend)
router.get("/:id/weather", async (req: Request, res: Response) => {
  try {
    const paramValidation = postIdSchema.safeParse(req.params);
    if (!paramValidation.success) {
      res.status(400).json({
        message: "ID post non valido",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const queryValidation = weatherQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      res.status(400).json({
        message: "Parametri di query non validi. Latitudine e longitudine sono obbligatorie.",
        errors: queryValidation.error.issues,
      });
      return;
    }

    const { id: postId } = paramValidation.data;
    const { days, latitude, longitude } = queryValidation.data;

    const [post] = await db
      .select({
        id: posts.id,
        address: posts.address,
        city: posts.city,
      })
      .from(posts)
      .where(eq(posts.id, postId));

    if (!post) {
      res.status(404).json({ message: "Immobile non trovato" });
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`Coordinate dal frontend per post ${postId}: lat=${latitude}, lon=${longitude}`);

    const forecast = await getWeatherForecast(
      latitude,
      longitude,
      Math.min(days, 16),
    );

    const formattedForecast = formatWeatherData(forecast);

    res.status(200).json({
      postId,
      location: {
        latitude,
        longitude,
        address: post.address,
        city: post.city,
        source: "frontend",
      },
      requestedDays: Math.min(days, 16),
      forecast: formattedForecast,
    });
  }
  catch (error) {
    console.error("Errore durante il recupero delle previsioni meteo:", error);
    res.status(500).json({ message: "Errore durante il recupero delle previsioni meteo" });
  }
});

export default router;
