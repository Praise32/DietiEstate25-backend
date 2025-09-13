import type { z } from "zod";

import { relations, sql } from "drizzle-orm";
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSchemaFactory, createUpdateSchema } from "drizzle-zod";

import { comments } from "./comments";
import { photos } from "./photo";
import user from "./user";

export const posts = pgTable("posts", {
  id: serial().primaryKey(),
  title: text().notNull(),
  description: text(),
  latitude: text(),
  longitude: text(),
  address: text().notNull(),
  city: text().notNull(),
  cap: integer().notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
  userId: serial("user_id").notNull().references(() => user.id),
});

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(user, {
    fields: [posts.userId],
    references: [user.id],
    relationName: "posts",
  }),
  photo: many(photos),
  comments: many(comments),
}));

const { createSelectSchema } = createSchemaFactory({
  coerce: true,
});

export const postIdSchema = createSelectSchema(posts).omit({
  title: true,
  description: true,
  latitude: true,
  longitude: true,
  address: true,
  city: true,
  cap: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
});

export const postInsertSchema = createInsertSchema(posts, {
  title: schema => schema.nonempty(),
  userId: schema => schema.min(1),
}).omit({
  updatedAt: true,
  createdAt: true,
  id: true,
});

export const postUpdateSchema = createUpdateSchema(posts).omit({
  updatedAt: true,
  createdAt: true,
  userId: true,
  id: true,
}).superRefine((data, context) => {
  if (Object.keys(data).length === 0) {
    context.addIssue({
      code: "custom",
      message: "Post data is required and must have at least one value",
    });
  }
});

export type PostInsertSchema = z.infer<typeof postInsertSchema>;
export type PostUpdateSchema = z.infer<typeof postUpdateSchema>;
export type PostIdSchema = z.infer<typeof postIdSchema>;
