import type { SQL } from "drizzle-orm";

import { and, eq, gte, lte, sql } from "drizzle-orm";

import type { ApiPostInsertSchema, PostInsertSchema, PostUpdateSchema, SearchFilters } from "@/db/schema/posts";

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

export async function createPost(postBody: ApiPostInsertSchema) {
  const { latitude, longitude, ...restOfBody } = postBody;

  const postDataWithLocation = {
    ...restOfBody,
    location: { lon: longitude, lat: latitude },
  };

  const [post] = await db.insert(posts).values(postDataWithLocation).returning();
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

export async function getAllPosts(filters: SearchFilters) {
  const { page, limit, ...searchParams } = filters;
  const offset = (page - 1) * limit;

  const conditions = buildWhereConditions(searchParams);

  // Controlla se ci sono condizioni prima di aggiungere .where()
  const query = db.select()
    .from(posts)
    .orderBy(sql`${posts.createdAt} desc`)
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  return query;
}

export async function countAllPosts(filters: Omit<SearchFilters, "page" | "limit">) {
  // Costruisce le stesse condizioni per contare correttamente
  const conditions = buildWhereConditions(filters);

  const result = await db.select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(and(...conditions)); // Applica gli stessi filtri

  return Number(result[0]?.count ?? 0);
}

// FUNZIONE HELPER PER COSTRUIRE LE CONDIZIONI
function buildWhereConditions(params: Omit<SearchFilters, "page" | "limit">): SQL[] {
  const conditions: SQL[] = [];
  conditions.push(sql`1 = 1`);

  if (params.city) {
    conditions.push(eq(posts.city, params.city));
  }
  if (params.listingType) {
    conditions.push(eq(posts.listingType, params.listingType));
  }
  if (params.minPrice) {
    conditions.push(gte(posts.price, params.minPrice.toString()));
  }
  if (params.maxPrice) {
    conditions.push(lte(posts.price, params.maxPrice.toString()));
  }
  if (params.minRooms) {
    conditions.push(gte(posts.rooms, params.minRooms));
  }
  if (params.maxRooms) {
    conditions.push(lte(posts.rooms, params.maxRooms));
  }
  if (params.minSize) {
    conditions.push(gte(posts.size, params.minSize));
  }
  if (params.hasElevator !== undefined) {
    conditions.push(eq(posts.hasElevator, params.hasElevator));
  }
  if (params.energyClass) {
    conditions.push(eq(posts.energyClass, params.energyClass));
  }

  if (params.latitude && params.longitude && params.radius) {
    // Crea un punto geografico dal centro della ricerca
    const searchCenterPoint = `SRID=4326;POINT(${params.longitude} ${params.latitude})`;

    // ST_DWithin controlla se la colonna `location` è entro `params.radius` metri dal punto centrale
    conditions.push(
      sql`ST_DWithin(
                ${posts.location}, 
                ${searchCenterPoint}::geography, 
                ${params.radius}
            )`,
    );
  }

  return conditions;
}
