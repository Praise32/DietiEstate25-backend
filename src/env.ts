import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().nonempty(),
  PORT: z.coerce.number().int().default(5003),
  JWT_SECRET_KEY: z.string().nonempty(),
  AWS_REGION: z.string().nonempty(),
  AWS_ACCESS_KEY_ID: z.string().nonempty(),
  AWS_SECRET_ACCESS_KEY: z.string().nonempty(),
  S3_BUCKET_NAME: z.string().nonempty(),
  GOOGLE_CLIENT_ID: z.string().nonempty(),
  GOOGLE_CLIENT_SECRET: z.string().nonempty(),
  GOOGLE_CALLBACK_URL: z.string().nonempty().url(),
  FRONTEND_URL: z.string().nonempty().url(),
  GMAIL_USER: z.string().nonempty().email(),
  GMAIL_APP_PASSWORD: z.string().nonempty(),
  EMAIL_FROM: z.string().nonempty().email(),
});

export type EnvSchemtype = z.infer<typeof EnvSchema>;

const result = EnvSchema.safeParse(process.env);

if (!result.success) {
  const message = result.error.message;
  // eslint-disable-next-line no-console
  console.log(message);
  process.exit(1);
}

export default EnvSchema.parse(process.env);
