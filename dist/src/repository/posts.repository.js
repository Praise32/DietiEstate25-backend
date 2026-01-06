import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { posts } from "../db/schema/posts.js";
import { geocodeAddress } from "../utils/geocoding-service.js";
import { calculateOffset, createSearchCenterPoint } from "./search-params.js";
async function resolvePostCoordinates(post) {
    if (post.latitude !== undefined && post.longitude !== undefined) {
        return { lat: post.latitude, lon: post.longitude };
    }
    const geocoded = await geocodeAddress(post.address, post.city, post.cap.toString());
    if (!geocoded) {
        throw new Error("Impossibile geocodificare l'indirizzo fornito");
    }
    return { lat: geocoded.latitude, lon: geocoded.longitude };
}
export async function createPost(post) {
    const coordinates = await resolvePostCoordinates(post);
    const { latitude: _lat, longitude: _lon, ...postWithoutCoords } = post;
    const [insertedPost] = await db
        .insert(posts)
        .values({
        ...postWithoutCoords,
        location: coordinates,
    })
        .returning();
    return insertedPost;
}
export async function getPostsNearby(searchParams) {
    const { latitude, longitude, radius, page, limit } = searchParams;
    const offset = calculateOffset(page, limit);
    const searchCenterPoint = createSearchCenterPoint(longitude, latitude);
    const nearbyPosts = await db
        .select()
        .from(posts)
        .where(sql `ST_DWithin(
        ${posts.location}, 
        ${searchCenterPoint}::geography, 
        ${radius}
      )`)
        .orderBy(sql `ST_Distance(
        ${posts.location}, 
        ${searchCenterPoint}::geography
      )`)
        .limit(limit)
        .offset(offset);
    return nearbyPosts;
}
export async function countPostsNearby(searchParams) {
    const { latitude, longitude, radius } = searchParams;
    const searchCenterPoint = createSearchCenterPoint(longitude, latitude);
    const result = await db
        .select({ count: sql `count(*)` })
        .from(posts)
        .where(sql `ST_DWithin(
        ${posts.location}, 
        ${searchCenterPoint}::geography, 
        ${radius}
      )`);
    return Number(result[0]?.count ?? 0);
}
export async function getPostsNearbyWithFilters(searchParams) {
    const { latitude, longitude, radius, filters, page, limit } = searchParams;
    const offset = calculateOffset(page, limit);
    const searchCenterPoint = createSearchCenterPoint(longitude, latitude);
    const conditions = buildWhereConditions(filters);
    conditions.push(sql `ST_DWithin(
      ${posts.location}, 
      ${searchCenterPoint}::geography, 
      ${radius}
    )`);
    const nearbyPosts = await db
        .select()
        .from(posts)
        .where(and(...conditions))
        .orderBy(sql `ST_Distance(
        ${posts.location}, 
        ${searchCenterPoint}::geography
      )`)
        .limit(limit)
        .offset(offset);
    return nearbyPosts;
}
export async function countPostsNearbyWithFilters(searchParams) {
    const { latitude, longitude, radius, filters } = searchParams;
    const searchCenterPoint = createSearchCenterPoint(longitude, latitude);
    const conditions = buildWhereConditions(filters);
    conditions.push(sql `ST_DWithin(
      ${posts.location}, 
      ${searchCenterPoint}::geography, 
      ${radius}
    )`);
    const result = await db
        .select({ count: sql `count(*)` })
        .from(posts)
        .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
}
export async function updatePost(postId, postBody) {
    const [post] = await db
        .update(posts)
        .set(postBody)
        .where(eq(posts.id, postId))
        .returning();
    return post;
}
export async function getPostById(id) {
    try {
        const [post] = await db.select().from(posts).where(eq(posts.id, id));
        return post;
    }
    catch (error) {
        console.error("Errore durante il recupero del post:", error);
        throw error;
    }
}
export async function deletePost(id) {
    const [deletedPost] = await db.delete(posts).where(eq(posts.id, id)).returning();
    return deletedPost;
}
export async function getAllPosts(filters) {
    const { page, limit, ...searchParams } = filters;
    const offset = calculateOffset(page, limit);
    const conditions = buildWhereConditions(searchParams);
    const query = db.select()
        .from(posts)
        .orderBy(sql `${posts.createdAt} desc`)
        .limit(limit)
        .offset(offset);
    if (conditions.length > 0) {
        return query.where(and(...conditions));
    }
    return query;
}
export async function getPostsByAgencyId(agencyId) {
    const agencyPosts = await db
        .select()
        .from(posts)
        .where(eq(posts.agencyId, agencyId))
        .orderBy(desc(posts.createdAt));
    return agencyPosts;
}
export async function countAllPosts(filters) {
    const conditions = buildWhereConditions(filters);
    const query = db.select({ count: sql `count(*)` }).from(posts);
    const result = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;
    return Number(result[0]?.count ?? 0);
}
function buildWhereConditions(params) {
    const conditions = [];
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
