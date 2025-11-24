import type { S3ClientConfig } from "@aws-sdk/client-s3";
import type { Request } from "express";

import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import multerS3 from "multer-s3";

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

// --- Configurazione Multer-S3 ---

export const upload = multer({
    // Imposta un limite di dimensione del file per sicurezza contro attacchi Denial of Service (DOS)
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 MB
  },
  storage: multerS3({
    s3, // Il client S3 configurato
    bucket: env.S3_BUCKET_NAME,
    metadata: (req: Request, file: Express.Multer.File, cb: (error: any, metadata?: any) => void) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req: Request, file: Express.Multer.File, cb: (error: any, key?: string) => void) => {
      // Funzione per determinare il nome del file (la "chiave") in S3
      const fileName = `${Date.now().toString()}-${file.originalname.toLowerCase().split(" ").join("-")}`;
      cb(null, fileName);
    },
    contentType: multerS3.AUTO_CONTENT_TYPE,
  }),
  // Filtro per accettare solo immagini
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // Accetta il file
    }
    else {
      cb(new Error("Tipo di file non valido. Sono consentite solo immagini (JPEG, PNG, GIF, WebP)."));
    }
  },
});

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
