import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  integer,
  numeric, // Usa numeric per i prezzi per evitare imprecisioni
  pgEnum, // Importa pgEnum per i tipi enumerativi
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSchemaFactory, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { agencies } from "./agencies";
import { photos } from "./photo";
import user from "./user";

// Definisci un tipo per la categoria dell'annuncio
export const listingTypeEnum = pgEnum("listing_type", ["vendita", "affitto"]);

// Definiamo un tipo custom per la colonna geography di PostGIS
const geography = customType<{
  data: { lat: number; lon: number };
  driverData: string;
}>({
  dataType() {
    // SRID 4326 è lo standard per le coordinate GPS (lat/lon)
    return "geography";
  },
  toDriver(value: { lat: number; lon: number }): string {
    return `SRID=4326;POINT(${value.lon} ${value.lat})`;
  },
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),

  // Campi di localizzazione
  // Rimuoviamo latitude e longitude
  // latitude: text("latitude"),
  // longitude: text("longitude"),
  location: geography("location").notNull(), // <-- NUOVA COLONNA GEOSPRAZIAL
  address: text("address").notNull(),
  city: text("city").notNull(),
  cap: integer("cap").notNull(),

  // === NUOVI CAMPI PER LA RICERCA AVANZATA ===
  price: numeric("price", { precision: 10, scale: 2 }).notNull(), // Es: 150000.00
  listingType: listingTypeEnum("listing_type").notNull(), // 'vendita' o 'affitto'
  rooms: integer("rooms"),
  size: integer("size"), // Dimensione in metri quadri
  floor: integer("floor"),
  hasElevator: boolean("has_elevator").default(false),
  energyClass: text("energy_class"), // Es: "A+", "G", etc.
  // Potresti aggiungere altri campi boolean o text qui (es. hasGarden, etc.)

  // Campi esistenti
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
  userId: serial("user_id").notNull().references(() => user.id),
  agencyId: integer("agency_id").references(() => agencies.id),
});

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(user, {
    fields: [posts.userId],
    references: [user.id],
    relationName: "posts",
  }),
  agency: one(agencies, {
    fields: [posts.agencyId],
    references: [agencies.id],
  }),
  photo: many(photos),
}));

const { createSelectSchema } = createSchemaFactory({
  coerce: true,
});

export const postIdSchema = createSelectSchema(posts).pick({
  id: true,
});

// Aggiungi un nuovo schema per il select completo
export const postSelectSchema = createSelectSchema(posts);

export const postInsertSchema = createInsertSchema(posts, {
  title: schema => schema.nonempty(),
  userId: schema => schema.min(1),
}).omit({
  updatedAt: true,
  createdAt: true,
  id: true,
  location: true, // Rimuoviamo location perché sarà calcolata automaticamente
}).extend({
  // Le coordinate diventano opzionali - se non fornite, verranno calcolate
  latitude: z.number().optional(),
  longitude: z.number().optional(),
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

export const searchFiltersSchema = z.object({
  // Filtri di testo
  city: z.string().optional(),
  listingType: z.enum(["vendita", "affitto"]).optional(),
  energyClass: z.string().optional(),

  // Filtri numerici (vengono da query string, quindi li trasformiamo)
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRooms: z.coerce.number().int().min(1).optional(),
  maxRooms: z.coerce.number().int().min(1).optional(),
  minSize: z.coerce.number().int().min(0).optional(),
  maxSize: z.coerce.number().int().min(0).optional(),

  // Filtri boolean
  hasElevator: z.enum(["true", "false"]).transform(val => val === "true").optional(),

  // Paginazione
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),

  // Parametri geografici per ricerca nelle vicinanze
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0).optional(), // Raggio in metri
}).refine((data) => {
  // Se un parametro geo è presente, devono esserlo tutti e tre
  if (data.latitude !== undefined || data.longitude !== undefined || data.radius !== undefined) {
    return data.latitude !== undefined && data.longitude !== undefined && data.radius !== undefined;
  }
  return true;
}, { message: "Per la ricerca a raggio sono necessari latitudine, longitudine e raggio." });

// Schema per l'inserimento via API che accetta lat/lon separati
export const apiPostInsertSchema = postInsertSchema.extend({
  latitude: z.number(),
  longitude: z.number(),
});

export type ApiPostInsertSchema = z.infer<typeof apiPostInsertSchema>;
export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type PostInsertSchema = z.infer<typeof postInsertSchema>;
export type PostUpdateSchema = z.infer<typeof postUpdateSchema>;
export type PostIdSchema = z.infer<typeof postIdSchema>;
export type PostSelectSchema = z.infer<typeof postSelectSchema>;
