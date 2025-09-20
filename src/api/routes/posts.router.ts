import express, { type Request, type Response, type RequestHandler } from "express";
import validate from "express-zod-safe";

import { deleteFileFromS3, getPresignedUrl, upload } from "@/api/middleware/photo.middleware";
import {
  apiPostInsertSchema,
  postIdSchema,
  postInsertSchema,
  postUpdateSchema,
  searchFiltersSchema,
} from "@/db/schema/posts";
import * as photoRepository from "@/repository/photos.repository";
import * as postsRepository from "@/repository/posts.repository";
import * as userRepository from "@/repository/user.repository";
import passport from "@/utils/passport";

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
  res.json({ ...foundPost, photos: photosWithUrls, author});
});

router.get("/", (async (req: Request, res: Response) => {
  // 1. Validare i query params con lo schema Zod
  const validation = searchFiltersSchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({ errors: validation.error.issues });
  }

  const filters = validation.data;

  try {
    // 2. Passare i filtri validati alle funzioni del repository
    const posts = await postsRepository.getAllPosts(filters);
    const total = await postsRepository.countAllPosts(filters);

    // Il resto della logica per arricchire con le foto rimane invariato
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

    res.status(200).json({
      data: postsWithPhotos,
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    });
  }
  catch (error) {
    console.error("Errore durante la ricerca dei post:", error);
    res.status(500).json({ message: "Errore interno del server" });
  }
}) as RequestHandler);


router.post("/", passport.authenticate("jwt", { session: false }), validate({ body: apiPostInsertSchema }), async (req, res) => {
  const PostInsert = await postsRepository.createPost({ ...req.body, userId: req.user!.id! });
  res.status(201).json(PostInsert);
});

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
      postsId: req.posts!.id!,
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

  // Controlla che la foto appartenga all'utente autenticato
  if (photo.userId !== req.user!.id) {
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
export default router;
