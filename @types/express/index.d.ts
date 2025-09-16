import type { AnyZodObject } from "zod";

import type { commentsIdSchema } from "@/db/schema/comments";
import type { PostIdSchema } from "@/db/schema/posts";
import type { UserSelectSchema } from "@/db/schema/user";

declare global {
  namespace Express {
    interface Request<Params extends AnyZodObject = AnyZodObject> {
      user?: UserSelectSchema & { role?: string };
      posts?: PostIdSchema;
      comments?: commentsIdSchema;
      files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined;
    }
  }
}
export {};
