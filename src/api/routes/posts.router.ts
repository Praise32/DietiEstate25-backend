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
import { formatWeatherData, getWeatherForecast } from "@/utils/weatherService";

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
  // Validare i query params con lo schema Zod
  const validation = searchFiltersSchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({ errors: validation.error.issues });
  }

  const filters = validation.data;

  try {
    let posts;
    let total;

    // Estrai i parametri di paginazione e geografici
    const { page, limit, latitude, longitude, radius, ...otherFilters } = filters;

    // Se ci sono parametri geografici, usa la ricerca nelle vicinanze
    if (latitude !== undefined && longitude !== undefined && radius !== undefined) {
      // Controlla se ci sono altri filtri
      const hasOtherFilters = Object.values(otherFilters).some(value => value !== undefined);

      if (hasOtherFilters) {
        // Ricerca geografica con filtri aggiuntivi
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
        // Solo ricerca geografica
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
      // Ricerca normale con filtri
      posts = await postsRepository.getAllPosts(filters);
      total = await postsRepository.countAllPosts(otherFilters);
    }

    // Arricchisci con le foto
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

    const response: any = {
      data: postsWithPhotos,
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    };

    // Aggiungi info geografiche se presenti
    if (latitude !== undefined && longitude !== undefined && radius !== undefined) {
      response.searchCenter = {
        latitude,
        longitude,
      };
      response.searchRadius = radius;
      response.searchType = "nearby";
    }
    else {
      response.searchType = "standard";
    }

    res.status(200).json(response);
  }
  catch (error) {
    console.error("Errore durante la ricerca dei post:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
}) as RequestHandler);

// ...existing code...

router.post("/", passport.authenticate("jwt", { session: false }), validate({ body: postInsertSchema }), async (req, res) => {
  try {
    // Recupera i dati dell'utente per ottenere la sua agenzia
    const user = await userRepository.getUserById(req.user!.id!);

    if (!user) {
      res.status(404).json({ message: "Utente non trovato" });
      return;
    }

    // Crea il post con userId e agencyId (se l'utente appartiene a un'agenzia)
    const PostInsert = await postsRepository.createPost({
      ...req.body,
      userId: req.user!.id!,
      agencyId: user.agencyId || null, // Aggiungi l'agencyId se l'utente appartiene a un'agenzia
    });

    res.status(201).json(PostInsert);
  }
  catch (error: any) {
    console.error("Errore durante la creazione del post:", error);

    // Gestisci errori specifici del geocoding
    if (error.message?.includes("geocodificare")) {
      res.status(400).json({
        message: "Indirizzo non valido o non trovato. Verifica che via, città e CAP siano corretti.",
        details: error.message,
      });
      return;
    }

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

  const Post = await postsRepository.updatePost(req.posts!.id, putBody.data);
  if (!Post) {
    res.status(404).end();
    return;
  }

  res.json(Post);
});

router.post("/:id/upload", authMiddleware, isOwnerMiddlewarePosts, upload.array("imageFiles", 5), async (req, res) => {
  if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
    res.status(400).json({ message: "Nessun file caricato." });
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
      userId: req.user!.id!,
      postsId: req.posts!.id,
    });
    photos.push(photo);
  }
  res.status(201).json(photos);
});

router.delete("/photos/:id", passport.authenticate("jwt", { session: false }), async (req, res) => {
  const photoId = Number(req.params.id);
  if (Number.isNaN(photoId)) {
    res.status(400).json({ message: "ID foto non valido." });
    return;
  }

  // Recupera la foto dal DB
  const photo = await photoRepository.getPhotoById(photoId);
  if (!photo) {
    res.status(404).json({ message: "Foto non trovata." });
    return;
  }

  // Recupera il post per verificare i permessi
  const post = await postsRepository.getPostById(photo.postsId);
  if (!post) {
    res.status(404).json({ message: "Post non trovato." });
    return;
  }

  // Verifica i permessi
  let isAuthorized = false;
  const currentUser = req.user!;

  // Admin e Support possono eliminare qualsiasi foto
  if (currentUser.role === "admin" || currentUser.role === "support") {
    isAuthorized = true;
  }
  // Il proprietario della foto può eliminarla
  else if (photo.userId === currentUser.id) {
    isAuthorized = true;
  }
  // Il proprietario del post può eliminare le foto
  else if (post.userId === currentUser.id) {
    isAuthorized = true;
  }
  // Manager può eliminare foto dei post della propria agenzia
  else if (currentUser.role === "manager" && post.agencyId !== null) {
    const agenciesRepository = await import("@/repository/agencies.repository");
    const managerAgency = await agenciesRepository.getAgencyByManagerId(currentUser.id!);
    if (managerAgency && managerAgency.id === post.agencyId) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    res.status(403).json({ message: "Non sei autorizzato a eliminare questa foto." });
    return;
  }

  // Elimina dal DB
  const deleted = await photoRepository.deletePhoto(photoId);
  if (!deleted) {
    res.status(500).json({ message: "Errore durante l'eliminazione della foto dal database." });
    return;
  }

  // Elimina da S3
  try {
    await deleteFileFromS3(photo.filename);
  }
  catch (err) {
    // Logga ma non blocca la risposta
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
router.get("/:id/weather", authMiddleware, async (req: Request, res: Response) => {
  try {
    // Validazione manuale dei parametri
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

    // Verifica che l'immobile esista
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

    console.log(`Coordinate dal frontend per post ${postId}: lat=${latitude}, lon=${longitude}`);

    // Ottieni previsioni meteo con le coordinate fornite
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
