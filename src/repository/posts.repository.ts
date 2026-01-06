import type { SQL } from "drizzle-orm";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { PostIdSchema, PostInsertSchema, PostSelectSchema, PostUpdateSchema, SearchFilters } from "@/db/schema/posts";

import { db } from "@/db";
import { posts } from "@/db/schema/posts";
import { geocodeAddress } from "@/utils/geocoding-service";

import type { NearbySearchParams } from "./search-params";

import { calculateOffset, createSearchCenterPoint } from "./search-params";

interface Coordinates {
  lat: number;
  lon: number;
}

async function resolvePostCoordinates(post: PostInsertSchema): Promise<Coordinates> {
  if (post.latitude !== undefined && post.longitude !== undefined) {
    return { lat: post.latitude, lon: post.longitude };
  }

  const geocoded = await geocodeAddress(post.address, post.city, post.cap.toString());
  if (!geocoded) {
    throw new Error("Impossibile geocodificare l'indirizzo fornito");
  }

  return { lat: geocoded.latitude, lon: geocoded.longitude };
}

/**
 * Crea un nuovo annuncio immobiliare con geocodifica automatica dell'indirizzo.
 *
 * @param post - Dati del post da inserire (se coordinate assenti, viene eseguita geocodifica)
 * @returns Promise del post creato con ID assegnato dal database
 * @throws Errore se la geocodifica fallisce e le coordinate non sono fornite esplicitamente
 */
export async function createPost(post: PostInsertSchema): Promise<PostIdSchema> {
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

/**
 * Recupera annunci immobiliari in un raggio geografico specificato usando PostGIS.
 *
 * @param searchParams - Parametri di ricerca contenenti coordinate, raggio (metri) e paginazione
 * @returns Promise di array di post ordinati per distanza crescente dal centro
 */
export async function getPostsNearby(searchParams: NearbySearchParams) {
  const { latitude, longitude, radius, page, limit } = searchParams;
  const offset = calculateOffset(page, limit);
  const searchCenterPoint = createSearchCenterPoint(longitude, latitude);

  const nearbyPosts = await db
    .select()
    .from(posts)
    .where(
      sql`ST_DWithin(
        ${posts.location}, 
        ${searchCenterPoint}::geography, 
        ${radius}
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

/**
 * Conta il numero totale di post in un raggio geografico per supportare paginazione.
 *
 * @param searchParams - Coordinate del centro di ricerca e raggio in metri
 * @returns Promise del conteggio totale di annunci trovati nell'area
 */
export async function countPostsNearby(searchParams: Pick<NearbySearchParams, "latitude" | "longitude" | "radius">) {
  const { latitude, longitude, radius } = searchParams;
  const searchCenterPoint = createSearchCenterPoint(longitude, latitude);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(
      sql`ST_DWithin(
        ${posts.location}, 
        ${searchCenterPoint}::geography, 
        ${radius}
      )`,
    );

  return Number(result[0]?.count ?? 0);
}

interface NearbyWithFiltersParams extends NearbySearchParams {
  filters: Omit<SearchFilters, "latitude" | "longitude" | "radius" | "page" | "limit">;
}

/**
 * Ricerca geografica avanzata con filtri aggiuntivi (prezzo, metratura, stanze, ecc.).
 *
 * @param searchParams - Parametri di ricerca geografica più filtri specifici immobiliari
 * @returns Promise di array di post filtrati e ordinati per distanza
 */
export async function getPostsNearbyWithFilters(searchParams: NearbyWithFiltersParams) {
  const { latitude, longitude, radius, filters, page, limit } = searchParams;
  const offset = calculateOffset(page, limit);
  const searchCenterPoint = createSearchCenterPoint(longitude, latitude);

  const conditions = buildWhereConditions(filters);

  conditions.push(
    sql`ST_DWithin(
      ${posts.location}, 
      ${searchCenterPoint}::geography, 
      ${radius}
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

/**
 * Conta post in area geografica applicando filtri di ricerca avanzati.
 *
 * @param searchParams - Coordinate, raggio e filtri immobiliari da applicare
 * @returns Promise del numero totale di risultati corrispondenti ai criteri
 */
export async function countPostsNearbyWithFilters(
  searchParams: Pick<NearbyWithFiltersParams, "latitude" | "longitude" | "radius" | "filters">,
) {
  const { latitude, longitude, radius, filters } = searchParams;
  const searchCenterPoint = createSearchCenterPoint(longitude, latitude);

  const conditions = buildWhereConditions(filters);

  conditions.push(
    sql`ST_DWithin(
      ${posts.location}, 
      ${searchCenterPoint}::geography, 
      ${radius}
    )`,
  );

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(and(...conditions));

  return Number(result[0]?.count ?? 0);
}

/**
 * Aggiorna i dati di un annuncio immobiliare esistente.
 *
 * @param postId - ID univoco del post da modificare
 * @param postBody - Oggetto contenente i campi da aggiornare (aggiornamento parziale supportato)
 * @returns Promise del post aggiornato con tutti i campi
 */
export async function updatePost(postId: number, postBody: PostUpdateSchema) {
  const [post] = await db
    .update(posts)
    .set(postBody)
    .where(eq(posts.id, postId))
    .returning();
  return post;
}

/**
 * Recupera un singolo annuncio tramite identificativo univoco.
 *
 * @param id - ID numerico del post richiesto
 * @returns Promise del post trovato o undefined se non esistente
 * @throws Rilancia eventuali errori del database dopo averli loggati
 */
export async function getPostById(id: number): Promise<PostSelectSchema | undefined> {
  try {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }
  catch (error) {
    console.error("Errore durante il recupero del post:", error);
    throw error;
  }
}

/**
 * Elimina un annuncio immobiliare dal database.
 *
 * @param id - ID del post da rimuovere definitivamente
 * @returns Promise del post eliminato (dati prima della cancellazione) o undefined se non trovato
 */
export async function deletePost(id: number): Promise<PostSelectSchema | undefined> {
  const [deletedPost] = await db.delete(posts).where(eq(posts.id, id)).returning();
  return deletedPost;
}

/**
 * Recupera tutti gli annunci con filtri opzionali e paginazione (senza ricerca geografica).
 *
 * @param filters - Criteri di ricerca contenenti paginazione e filtri immobiliari (città, prezzo, stanze, ecc.)
 * @returns Promise di array di post ordinati per data creazione decrescente
 */
export async function getAllPosts(filters: SearchFilters) {
  const { page, limit, ...searchParams } = filters;
  const offset = calculateOffset(page, limit);

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

/**
 * Recupera tutti gli annunci pubblicati da una specifica agenzia immobiliare.
 *
 * @param agencyId - ID dell'agenzia di cui recuperare gli annunci
 * @returns Promise di array di post dell'agenzia ordinati dal più recente
 */
export async function getPostsByAgencyId(agencyId: number) {
  const agencyPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.agencyId, agencyId))
    .orderBy(desc(posts.createdAt));

  return agencyPosts;
}

/**
 * Conta il numero totale di post applicando filtri di ricerca (esclude paginazione).
 *
 * @param filters - Criteri di filtro senza parametri di paginazione
 * @returns Promise del conteggio totale per calcolare pagine disponibili
 */
export async function countAllPosts(filters: Omit<SearchFilters, "page" | "limit">) {
  const conditions = buildWhereConditions(filters);

  const query = db.select({ count: sql<number>`count(*)` }).from(posts);

  const result = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  return Number(result[0]?.count ?? 0);
}

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
