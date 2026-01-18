import type { S3ClientConfig } from "@aws-sdk/client-s3";
import type { Request } from "express";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import sharp from "sharp";

import env from "@/env";

// --- Configurazione AWS S3 ---
const s3Config: S3ClientConfig = {
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
};

const s3 = new S3Client(s3Config);

// --- Configurazione Multer per storage in memoria ---

export const upload = multer({
  // Imposta un limite di dimensione del file per sicurezza contro attacchi Denial of Service (DOS)
  // Limite più alto perché le immagini verranno compresse prima del caricamento su S3
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB - permette immagini ad alta risoluzione che poi verranno compresse
  },
  storage: multer.memoryStorage(), // Usa storage in memoria per permettere la compressione
  // Filtro per accettare solo immagini
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Accetta il file
    }
    else {
      cb(new Error("Tipo di file non valido. Sono consentite solo immagini (JPEG, PNG, GIF, WebP)."));
    }
  },
});

/**
 * Comprimi un'immagine usando sharp e caricala su S3
 * @param file - File multer con buffer in memoria
 * @returns Informazioni sul file caricato (chiave, location, bucket, etc.)
 */
export async function compressAndUploadToS3(file: Express.Multer.File) {
  try {
    // Genera il nome del file
    const fileName = `${Date.now().toString()}-${file.originalname.toLowerCase().split(" ").join("-")}`;
    
    // Comprimi l'immagine con sharp
    // Ridimensiona a max 1920x1920 mantenendo le proporzioni e comprimi con qualità 80%
    const compressedBuffer = await sharp(file.buffer)
      .resize(1920, 1920, {
        fit: "inside", // Mantiene le proporzioni
        withoutEnlargement: true, // Non ingrandisce immagini più piccole
      })
      .jpeg({ quality: 80, progressive: true }) // Converti a JPEG con qualità 80%
      .toBuffer();

    // Carica su S3
    const uploadParams = {
      Bucket: env.S3_BUCKET_NAME,
      Key: fileName,
      Body: compressedBuffer,
      ContentType: "image/jpeg", // Sempre JPEG dopo la compressione
    };

    await s3.send(new PutObjectCommand(uploadParams));

    // Restituisci info simili a multer-s3
    return {
      key: fileName,
      location: `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${fileName}`,
      bucket: env.S3_BUCKET_NAME,
      contentType: "image/jpeg",
      size: compressedBuffer.length,
    };
  }
  catch (error) {
    console.error("Errore durante la compressione e upload:", error);
    throw error;
  }
}

// funzione per eliminare un file da S3
export async function deleteFileFromS3(fileName: string): Promise<void> {
  try {
    const params = {
      Bucket: env.S3_BUCKET_NAME,
      Key: fileName,
    };

    await s3.send(new DeleteObjectCommand(params));
  }
  catch (error) {
    console.error("Errore durante l'eliminazione del file da S3:", error);
  }
}

export async function getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
