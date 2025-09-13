import { eq } from "drizzle-orm";

import type { CommentInsertSchemaType, CommentUpdateSchemaType } from "@/db/schema/comments";

import { db } from "@/db";
import { comments } from "@/db/schema/comments";

export async function createComment(data: CommentInsertSchemaType) {
  const [comment] = await db.insert(comments).values(data).returning();
  return comment;
}

export async function getCommentsByPostId(postId: number) {
  const commment = await db.select().from(comments).where(eq(comments.postId, postId));
  return commment;
}

export async function updateComment(Id: number, commentBody: CommentUpdateSchemaType) {
  const [comment] = await db
    .update(comments)
    .set(commentBody)
    .where(eq(comments.id, Id))
    .returning();
  return comment;
}

export async function deleteComment(id: number) {
  return await db.delete(comments).where(eq(comments.id, id)).returning();
}

export async function getCommentById(id: number) {
  const [comment] = await db.select().from(comments).where(eq(comments.id, id));
  return comment;
}
