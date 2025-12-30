import type { SQL } from "drizzle-orm";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { PostIdSchema, PostInsertSchema, PostSelectSchema, PostUpdateSchema, SearchFilters } from "@/db/schema/posts";

import { db } from "@/db";
import { photos } from "@/db/schema/photo";
import { posts } from "@/db/schema/posts";
import { geocodeAddress } from "@/utils/geocoding-service";

// Restituisce tutti i post con le relative foto (array)
export async function getAllPostsWithPhotos() {
  const results = await db
    .select({
      post: posts,
      photo: photos,
    })
    .from(posts)
    .leftJoin(photos, eq(photos.postsId, posts.id));

  const postsMap = new Map<number, {
    id: number;
    title: string;
    description: string | null;
    address: string;
    city: string;
    cap: number;
    price: string;
    listingType: "vendita" | "affitto";
    rooms: number | null;
    size: number | null;
    floor: number | null;
    hasElevator: boolean | null;
    energyClass: string | null;
    createdAt: string;
    updatedAt: string;
    userId: number;
    agencyId: number | null;
    location: unknown;
    photo: Array<typeof photos.$inferSelect>;
  }>();

  for (const row of results) {
    const postId = row.post.id;
    if (!postsMap.has(postId)) {
      postsMap.set(postId, { ...row.post, photo: [] });
    }
    if (row.photo?.id) {
      postsMap.get(postId)?.photo.push(row.photo);
    }
  }
  return Array.from(postsMap.values());
}

export async function createPost(post: PostInsertSchema): Promise<PostIdSchema> {
  let coordinates: { lat: number; lon: number };

  if (post.latitude !== undefined && post.longitude !== undefined) {
    coordinates = { lat: post.latitude, lon: post.longitude };
  }
  else {
    const geocoded = await geocodeAddress(post.address, post.city, post.cap.toString());
    if (!geocoded) {
      throw new Error("Impossibile geocodificare l'indirizzo fornito");
    }
    coordinates = { lat: geocoded.latitude, lon: geocoded.longitude };
  }

  const { latitude: _lat, longitude: _lon, ...postWithoutCoords } = post;

  const [insertedPost] = await db
    .insert(posts)
    .values({
      ...postWithoutCoords,
      location: coordinates,
    })
    .returning();

  // eslint-disable-next-line no-console
  console.log("Post creato con coordinate:", coordinates);

  return insertedPost;
}

// Ricerca immobili nelle vicinanze con paginazione
export async function getPostsNearby(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  page: number = 1,
  limit: number = 10,
) {
  const offset = (page - 1) * limit;
  const searchCenterPoint = `SRID=4326;POINT(${longitude} ${latitude})`;

  const nearbyPosts = await db
    .select()
    .from(posts)
    .where(
      sql`ST_DWithin(
        ${posts.location}, 
        ${searchCenterPoint}::geography, 
        ${radiusMeters}
      )`,
    )
    .orderBy(
      sql`ST_Distance(
        ${posts.location}, 
        ${searchCenterPoint}::geography
      )`,
    )
    .limit(limit)
    .offset(offset);

  return nearbyPosts;
}

// Conta immobili nelle vicinanze
export async function countPostsNearby(
  latitude: number,
  longitude: number,
  radiusMeters: number,
) {
  const searchCenterPoint = `SRID=4326;POINT(${longitude} ${latitude})`;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(
      sql`ST_DWithin(
        ${posts.location}, 
        ${searchCenterPoint}::geography, 
        ${radiusMeters}
      )`,
    );

  return Number(result[0]?.count ?? 0);
}

// Ricerca immobili nelle vicinanze con filtri aggiuntivi
export async function getPostsNearbyWithFilters(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  filters: Omit<SearchFilters, "latitude" | "longitude" | "radius" | "page" | "limit">,
  page: number = 1,
  limit: number = 10,
) {
  const offset = (page - 1) * limit;
  const searchCenterPoint = `SRID=4326;POINT(${longitude} ${latitude})`;

  const conditions = buildWhereConditions(filters);

  conditions.push(
    sql`ST_DWithin(
      ${posts.location}, 
      ${searchCenterPoint}::geography, 
      ${radiusMeters}
    )`,
  );

  const nearbyPosts = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(
      sql`ST_Distance(
        ${posts.location}, 
        ${searchCenterPoint}::geography
      )`,
    )
    .limit(limit)
    .offset(offset);

  return nearbyPosts;
}

// Conta immobili nelle vicinanze con filtri
export async function countPostsNearbyWithFilters(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  filters: Omit<SearchFilters, "latitude" | "longitude" | "radius" | "page" | "limit">,
) {
  const searchCenterPoint = `SRID=4326;POINT(${longitude} ${latitude})`;

  const conditions = buildWhereConditions(filters);

  conditions.push(
    sql`ST_DWithin(
      ${posts.location}, 
      ${searchCenterPoint}::geography, 
      ${radiusMeters}
    )`,
  );

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(and(...conditions));

  return Number(result[0]?.count ?? 0);
}

export async function updatePost(postId: number, postBody: PostUpdateSchema) {
  const [post] = await db
    .update(posts)
    .set(postBody)
    .where(eq(posts.id, postId))
    .returning();
  return post;
}

export async function getPostById(id: number): Promise<PostSelectSchema | undefined> {
  try {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    // eslint-disable-next-line no-console
    console.log("Post trovato:", post);
    return post;
  }
  catch (error) {
    console.error("Errore durante il recupero del post:", error);
    throw error;
  }
}

export async function deletePost(id: number): Promise<PostSelectSchema | undefined> {
  const [deletedPost] = await db.delete(posts).where(eq(posts.id, id)).returning();
  return deletedPost;
}

export async function getAllPosts(filters: SearchFilters) {
  const { page, limit, ...searchParams } = filters;
  const offset = (page - 1) * limit;

  const conditions = buildWhereConditions(searchParams);

  const query = db.select()
    .from(posts)
    .orderBy(sql`${posts.createdAt} desc`)
    .limit(limit)
    .offset(offset);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }

  return query;
}

export async function getPostsByAgencyId(agencyId: number) {
  const agencyPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.agencyId, agencyId))
    .orderBy(desc(posts.createdAt));

  return agencyPosts;
}

export async function getPostsByAgencyIdWithPhotos(agencyId: number) {
  const agencyPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.agencyId, agencyId))
    .orderBy(desc(posts.createdAt));

  const postsWithPhotos = await Promise.all(
    agencyPosts.map(async (post) => {
      const postPhotos = await db
        .select()
        .from(photos)
        .where(eq(photos.postsId, post.id));

      return { ...post, photos: postPhotos };
    }),
  );

  return postsWithPhotos;
}

export async function countAllPosts(filters: Omit<SearchFilters, "page" | "limit">) {
  const conditions = buildWhereConditions(filters);

  const query = db.select({ count: sql<number>`count(*)` }).from(posts);

  const result = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  return Number(result[0]?.count ?? 0);
}

// FUNZIONE HELPER PER COSTRUIRE LE CONDIZIONI
function buildWhereConditions(params: Omit<SearchFilters, "page" | "limit">): SQL[] {
  const conditions: SQL[] = [];

  if (params.city) {
    conditions.push(eq(posts.city, params.city));
  }
  if (params.listingType) {
    conditions.push(eq(posts.listingType, params.listingType));
  }
  if (params.minPrice !== undefined) {
    conditions.push(gte(posts.price, params.minPrice.toString()));
  }
  if (params.maxPrice !== undefined) {
    conditions.push(lte(posts.price, params.maxPrice.toString()));
  }
  if (params.minRooms !== undefined) {
    conditions.push(gte(posts.rooms, params.minRooms));
  }
  if (params.maxRooms !== undefined) {
    conditions.push(lte(posts.rooms, params.maxRooms));
  }
  if (params.minSize !== undefined) {
    conditions.push(gte(posts.size, params.minSize));
  }
  if (params.maxSize !== undefined) {
    conditions.push(lte(posts.size, params.maxSize));
  }
  if (params.hasElevator !== undefined) {
    conditions.push(eq(posts.hasElevator, params.hasElevator));
  }
  if (params.energyClass) {
    conditions.push(eq(posts.energyClass, params.energyClass));
  }

  return conditions;
}
