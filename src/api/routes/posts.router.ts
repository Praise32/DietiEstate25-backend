import type { Request, RequestHandler, Response } from "express";

import { eq } from "drizzle-orm";
import express from "express";
import validate from "express-zod-safe";
import { z } from "zod";

import { deleteFileFromS3, upload } from "@/api/middleware/photo.middleware";
import { db } from "@/db";
import {
  postIdSchema,
  postInsertSchema,
  posts,
  postUpdateSchema,
  searchFiltersSchema,
} from "@/db/schema/posts";
import * as agenciesRepository from "@/repository/agencies.repository";
import * as photoRepository from "@/repository/photos.repository";
import * as postsRepository from "@/repository/posts.repository";
import * as userRepository from "@/repository/user.repository";
import {
  enrichPostWithPhotos,
  sendBadRequestResponse,
  sendForbiddenResponse,
  sendInternalErrorResponse,
  sendNotFoundResponse,
  sendUnauthorizedResponse,
} from "@/utils";
import passport from "@/utils/passport";
import { formatWeatherData, getWeatherForecast } from "@/utils/weather-service";

import { authMiddleware, isOwnerMiddlewarePosts } from "../middleware/auth.middleware";

const router = express.Router();

async function fetchPostWithAuthorAndPhotos(postId: number) {
  const foundPost = await postsRepository.getPostById(postId);
  if (!foundPost) {
    return null;
  }

  const author = await userRepository.getUserById(foundPost.userId);
  if (!author) {
    return null;
  }

  const postWithPhotos = await enrichPostWithPhotos(foundPost);
  return { ...postWithPhotos, author };
}

router.get("/:id", validate({ params: postIdSchema }), async (req, res) => {
  const postDetails = await fetchPostWithAuthorAndPhotos(req.params.id);

  if (!postDetails) {
    sendNotFoundResponse(res, "Post o autore non trovato");
    return;
  }

  res.json(postDetails);
});

interface SearchResult {
  posts: unknown[];
  total: number;
}

async function executePostSearch(filters: typeof searchFiltersSchema._type): Promise<SearchResult> {
  const { page, limit, latitude, longitude, radius, ...otherFilters } = filters;

  const hasLocationSearch = latitude !== undefined && longitude !== undefined && radius !== undefined;
  const hasAdditionalFilters = Object.values(otherFilters).some(value => value !== undefined);

  if (hasLocationSearch) {
    if (hasAdditionalFilters) {
      const posts = await postsRepository.getPostsNearbyWithFilters({
        latitude: latitude!,
        longitude: longitude!,
        radius: radius!,
        page,
        limit,
        filters: otherFilters,
      });
      const total = await postsRepository.countPostsNearbyWithFilters({
        latitude: latitude!,
        longitude: longitude!,
        radius: radius!,
        filters: otherFilters,
      });
      return { posts, total };
    }

    const posts = await postsRepository.getPostsNearby({
      latitude: latitude!,
      longitude: longitude!,
      radius: radius!,
      page,
      limit,
    });
    const total = await postsRepository.countPostsNearby({
      latitude: latitude!,
      longitude: longitude!,
      radius: radius!,
    });
    return { posts, total };
  }

  const posts = await postsRepository.getAllPosts(filters);
  const total = await postsRepository.countAllPosts(otherFilters);
  return { posts, total };
}

async function enrichPostsWithPhotos(posts: Array<{ id: number; [key: string]: unknown }>) {
  return Promise.all(posts.map(post => enrichPostWithPhotos(post)));
}

function buildSearchResponse(
  postsWithPhotos: unknown[],
  filters: typeof searchFiltersSchema._type,
  total: number,
) {
  const { page, limit, latitude, longitude, radius } = filters;

  const response: {
    data: unknown[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    searchCenter?: { latitude: number; longitude: number };
    searchRadius?: number;
    searchType: string;
  } = {
    data: postsWithPhotos,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    searchType: "standard",
  };

  if (latitude !== undefined && longitude !== undefined && radius !== undefined) {
    response.searchCenter = { latitude, longitude };
    response.searchRadius = radius;
    response.searchType = "nearby";
  }

  return response;
}

router.get("/", (async (req: Request, res: Response) => {
  const validation = searchFiltersSchema.safeParse(req.query);

  if (!validation.success) {
    sendBadRequestResponse(res, { errors: validation.error.issues });
    return;
  }

  try {
    const filters = validation.data;
    const { posts, total } = await executePostSearch(filters);
    const postsWithPhotos = await enrichPostsWithPhotos(posts as Array<{ id: number; [key: string]: unknown }>);
    const response = buildSearchResponse(postsWithPhotos, filters, total);

    res.status(200).json(response);
  }
  catch (error) {
    console.error("Errore durante la ricerca dei post:", error);
    sendInternalErrorResponse(res);
  }
}) as RequestHandler);

async function createPostForUser(userId: number, postData: typeof postInsertSchema._type) {
  const user = await userRepository.getUserById(userId);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return postsRepository.createPost({
    ...postData,
    userId,
    agencyId: user.agencyId || null,
  });
}

router.post("/", passport.authenticate("jwt", { session: false }), validate({ body: postInsertSchema }), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      sendUnauthorizedResponse(res);
      return;
    }

    const postInsert = await createPostForUser(userId, req.body);
    res.status(201).json(postInsert);
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND") {
        sendNotFoundResponse(res, "Utente non trovato");
        return;
      }
      if (error.message.includes("geocodificare")) {
        sendBadRequestResponse(res, {
          message: "Indirizzo non valido o non trovato. Verifica che via, città e CAP siano corretti.",
          details: error.message,
        });
        return;
      }
    }

    console.error("Errore durante la creazione del post:", error);
    sendInternalErrorResponse(res);
  }
});

async function deleteAllPostPhotos(postId: number) {
  const photos = await photoRepository.getAllPhotoByPostId(postId);

  if (photos && Array.isArray(photos)) {
    for (const photo of photos) {
      await deleteFileFromS3(photo.filename);
    }
  }
}

router.delete("/:id", passport.authenticate("jwt", { session: false }), isOwnerMiddlewarePosts, async (req, res) => {
  const deleteValidation = postIdSchema.safeParse(req.params);
  if (!deleteValidation.success || !deleteValidation.data) {
    sendBadRequestResponse(res, deleteValidation.error);
    return;
  }

  await deleteAllPostPhotos(deleteValidation.data.id);

  const deletedPost = await postsRepository.deletePost(deleteValidation.data.id);
  if (!deletedPost) {
    sendNotFoundResponse(res);
    return;
  }

  res.json(deletedPost);
});

router.put("/:id", authMiddleware, isOwnerMiddlewarePosts, async (req, res) => {
  const paramValidation = postIdSchema.safeParse(req.params);
  if (!paramValidation.success || !paramValidation.data) {
    sendBadRequestResponse(res, paramValidation.error);
    return;
  }

  const bodyValidation = postUpdateSchema.safeParse(req.body);
  if (!bodyValidation.success || !bodyValidation.data) {
    sendBadRequestResponse(res, bodyValidation.error);
    return;
  }

  const postId = req.posts?.id;
  if (!postId) {
    sendNotFoundResponse(res, "Post non trovato");
    return;
  }

  const updatedPost = await postsRepository.updatePost(postId, bodyValidation.data);
  if (!updatedPost) {
    sendNotFoundResponse(res);
    return;
  }

  res.json(updatedPost);
});

router.post("/:id/upload", authMiddleware, isOwnerMiddlewarePosts, upload.array("imageFiles", 5), async (req, res) => {
  if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
    sendBadRequestResponse(res, "Nessun file caricato.");
    return;
  }

  const userId = req.user?.id;
  const postId = req.posts?.id;

  if (!userId || !postId) {
    sendUnauthorizedResponse(res, "Utente o post non trovato");
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

async function isUserAuthorizedToDeletePhoto(
  currentUser: Express.User,
  photo: { userId: number },
  post: { userId: number; agencyId: number | null },
): Promise<boolean> {
  if (currentUser.role === "admin" || currentUser.role === "support") {
    return true;
  }

  if (photo.userId === currentUser.id) {
    return true;
  }

  if (post.userId === currentUser.id) {
    return true;
  }

  if (currentUser.role === "manager" && post.agencyId !== null && currentUser.id) {
    const managerAgency = await agenciesRepository.getAgencyByManagerId(currentUser.id);
    return !!(managerAgency && managerAgency.id === post.agencyId);
  }

  return false;
}

router.delete("/photos/:id", passport.authenticate("jwt", { session: false }), async (req, res) => {
  const photoId = Number(req.params.id);
  if (Number.isNaN(photoId)) {
    sendBadRequestResponse(res, "ID foto non valido.");
    return;
  }

  const photo = await photoRepository.getPhotoById(photoId);
  if (!photo) {
    sendNotFoundResponse(res, "Foto non trovata.");
    return;
  }

  const post = await postsRepository.getPostById(photo.postsId);
  if (!post) {
    sendNotFoundResponse(res, "Post non trovato.");
    return;
  }

  const currentUser = req.user;
  if (!currentUser) {
    sendUnauthorizedResponse(res);
    return;
  }

  const isAuthorized = await isUserAuthorizedToDeletePhoto(currentUser, photo, post);

  if (!isAuthorized) {
    sendForbiddenResponse(res, "Non sei autorizzato a eliminare questa foto.");
    return;
  }

  const deleted = await photoRepository.deletePhoto(photoId);
  if (!deleted) {
    sendInternalErrorResponse(res, "Errore durante l'eliminazione della foto dal database.");
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
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

async function fetchPostLocation(postId: number) {
  const [post] = await db
    .select({
      id: posts.id,
      address: posts.address,
      city: posts.city,
    })
    .from(posts)
    .where(eq(posts.id, postId));

  return post;
}

router.get("/:id/weather", async (req: Request, res: Response) => {
  try {
    const paramValidation = postIdSchema.safeParse(req.params);
    if (!paramValidation.success) {
      sendBadRequestResponse(res, {
        message: "ID post non valido",
        errors: paramValidation.error.issues,
      });
      return;
    }

    const queryValidation = weatherQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      sendBadRequestResponse(res, {
        message: "Parametri di query non validi. Latitudine e longitudine sono obbligatorie.",
        errors: queryValidation.error.issues,
      });
      return;
    }

    const { id: postId } = paramValidation.data;
    const { days, latitude, longitude } = queryValidation.data;

    const post = await fetchPostLocation(postId);

    if (!post) {
      sendNotFoundResponse(res, "Immobile non trovato");
      return;
    }

    const forecast = await getWeatherForecast(latitude, longitude, Math.min(days, 16));
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
    sendInternalErrorResponse(res, "Errore durante il recupero delle previsioni meteo");
  }
});

export default router;
