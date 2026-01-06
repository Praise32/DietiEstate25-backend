import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import multerS3 from "multer-s3";
import env from "../../env.js";
const s3Config = {
    region: env.AWS_REGION,
    credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
};
const s3 = new S3Client(s3Config);
export const upload = multer({
    limits: {
        fileSize: 8 * 1024 * 1024,
    },
    storage: multerS3({
        s3,
        bucket: env.S3_BUCKET_NAME,
        metadata: (_req, file, cb) => {
            cb(null, { fieldName: file.fieldname });
        },
        key: (_req, file, cb) => {
            const fileName = `${Date.now().toString()}-${file.originalname.toLowerCase().split(" ").join("-")}`;
            cb(null, fileName);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE,
    }),
    fileFilter: (_req, file, cb) => {
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Tipo di file non valido. Sono consentite solo immagini (JPEG, PNG, GIF, WebP)."));
        }
    },
});
export async function deleteFileFromS3(fileName) {
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
export async function getPresignedUrl(key, expiresInSeconds = 3600) {
    const command = new GetObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: key,
    });
    return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
