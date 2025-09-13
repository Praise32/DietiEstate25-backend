import { eq, sql } from "drizzle-orm";

import type { PostInsertSchema, PostUpdateSchema } from "@/db/schema/posts";

import { db } from "@/db";
import { photos } from "@/db/schema/photo";
import { posts } from "@/db/schema/posts";

// Restituisce tutti i post con le relative foto (array)
export async function getAllPostsWithPhotos() {
  // Fai una LEFT JOIN tra posts e photos
  const results = await db
    .select({
      post: posts,
      photo: photos,
    })
    .from(posts)
    .leftJoin(photos, eq(photos.postsId, posts.id));

  // Raggruppa le foto per ogni post
  const postsMap = new Map<number, any>();
  for (const row of results) {
    const postId = row.post.id;
    if (!postsMap.has(postId)) {
      postsMap.set(postId, { ...row.post, photo: [] });
    }
    if (row.photo && row.photo.id) {
      postsMap.get(postId).photo.push(row.photo);
    }
  }
  return Array.from(postsMap.values());
}

export async function createPost(postBody: PostInsertSchema) {
  const [post] = await db.insert(posts).values(postBody).returning();
  return post;
}

export async function updatePost(postId: number, postBody: PostUpdateSchema) {
  const [post] = await db
    .update(posts)
    .set(postBody)
    .where(eq(posts.id, postId))
    .returning();
  return post;
}
export async function getPostById(id: number) {
  const [post] = await db.select().from(posts).where(eq(posts.id, id));
  return post;
}

export async function deletePost(id: number) {
  return await db.delete(posts).where(eq(posts.id, id)).returning();
}

export async function getAllPosts({ limit, offset }: { limit: number; offset: number }) {
  return db.select().from(posts).limit(limit).offset(offset);
}

export async function countAllPosts() {
  const result = await db.select({ count: sql<number>`count(*)` }).from(posts);
  return Number(result[0]?.count ?? 0);
}
