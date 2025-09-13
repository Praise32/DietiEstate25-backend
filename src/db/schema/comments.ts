import type { z } from "zod";

import { relations, sql } from "drizzle-orm";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSchemaFactory,
} from "drizzle-zod";

import { posts } from "./posts";
import user from "./user";

export const comments = pgTable("comments", {
  id: serial().primaryKey(),
  text: text().notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
  userId: serial("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  postId: serial("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
});

const { createSelectSchema } = createSchemaFactory({
  // This configuration will only coerce dates. Set `coerce` to `true` to coerce all data types or specify others
  coerce: true,
});

export const commentsIdSchema = createSelectSchema(comments).omit({
  text: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  postId: true,
});

export const commentsInsertSchema = createInsertSchema(comments, {
  text: schema => schema.nonempty(),
  userId: schema => schema.min(1),
  postId: schema => schema.min(1),
}).omit({
  updatedAt: true,
  createdAt: true,
  id: true,
});

export const commentsUpdateSchema = createSelectSchema(comments).omit({
  createdAt: true,
  userId: true,
  postId: true,
  updatedAt: true,
  id: true,
}).superRefine((data, context) => {
  if (Object.keys(data).length === 0) {
    context.addIssue({
      code: "custom",
      message: "Post data is required and must have at least one value",
    });
  }
});

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(user, {
    fields: [comments.userId],
    references: [user.id],
    relationName: "comments",
  }),
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
    relationName: "comments",
  }),
}));

export type CommentInsertSchemaType = z.infer<typeof commentsInsertSchema>;
export type CommentUpdateSchemaType = z.infer<typeof commentsUpdateSchema>;
export type CommentsIdSchemaType = z.infer<typeof commentsIdSchema>;
