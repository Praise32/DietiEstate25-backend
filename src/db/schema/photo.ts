import type { z } from "zod";

import { relations, sql } from "drizzle-orm";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import {
  createSchemaFactory,
} from "drizzle-zod";

import { posts } from "./posts";
import user from "./user";

export const photos = pgTable("photos", {
  id: serial().primaryKey(),
  url: text().notNull(),
  filename: text().notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
  userId: serial("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  postsId: serial("posts_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
});

const { createSelectSchema } = createSchemaFactory({
  // This configuration will only coerce dates. Set `coerce` to `true` to coerce all data types or specify others
  coerce: true,
});

export const photosIdSchema = createSelectSchema(photos).omit({
  url: true,
  filename: true,
  createdAt: true,
  userId: true,
  postsId: true,
});

export const photosInsertSchema = createSelectSchema(photos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const photosUpdateSchema = createSelectSchema(photos).omit({
  createdAt: true,
  userId: true,
  postsId: true,
});

export const photosRelations = relations(photos, ({ one }) => ({
  author: one(user, {
    fields: [photos.userId],
    references: [user.id],
    relationName: "uploadUser",
  }),
  post: one(posts, {
    fields: [photos.postsId],
    references: [posts.id],
    relationName: "postPhotos",
  }),
}));

export type PhotoInsertSchemaType = z.infer<typeof photosInsertSchema>;
export type PhotoUpdateSchemaType = z.infer<typeof photosUpdateSchema>;
export type PhotosIdSchemaType = z.infer<typeof photosIdSchema>;
