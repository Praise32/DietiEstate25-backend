import { relations, sql } from "drizzle-orm";
import { boolean, customType, integer, numeric, pgEnum, pgTable, serial, text, timestamp, } from "drizzle-orm/pg-core";
import { createInsertSchema, createSchemaFactory, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";
import { agencies } from "./agencies.js";
import { photos } from "./photo.js";
import user from "./user.js";
export const listingTypeEnum = pgEnum("listing_type", ["vendita", "affitto"]);
const geography = customType({
    dataType() {
        return "geography";
    },
    toDriver(value) {
        return `SRID=4326;POINT(${value.lon} ${value.lat})`;
    },
});
export const posts = pgTable("posts", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    location: geography("location").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    cap: integer("cap").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    listingType: listingTypeEnum("listing_type").notNull(),
    rooms: integer("rooms"),
    size: integer("size"),
    floor: integer("floor"),
    hasElevator: boolean("has_elevator").default(false),
    energyClass: text("energy_class"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" })
        .notNull()
        .defaultNow()
        .$onUpdate(() => sql `now()`),
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
export const postSelectSchema = createSelectSchema(posts);
export const postInsertSchema = createInsertSchema(posts, {
    title: schema => schema.nonempty(),
    userId: schema => schema.min(1),
}).omit({
    updatedAt: true,
    createdAt: true,
    id: true,
    location: true,
}).extend({
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
    city: z.string().optional(),
    listingType: z.enum(["vendita", "affitto"]).optional(),
    energyClass: z.string().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    minRooms: z.coerce.number().int().min(1).optional(),
    maxRooms: z.coerce.number().int().min(1).optional(),
    minSize: z.coerce.number().int().min(0).optional(),
    maxSize: z.coerce.number().int().min(0).optional(),
    hasElevator: z.enum(["true", "false"]).transform(val => val === "true").optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(0).optional(),
}).refine((data) => {
    if (data.latitude !== undefined || data.longitude !== undefined || data.radius !== undefined) {
        return data.latitude !== undefined && data.longitude !== undefined && data.radius !== undefined;
    }
    return true;
}, { message: "Per la ricerca a raggio sono necessari latitudine, longitudine e raggio." });
export const apiPostInsertSchema = postInsertSchema.extend({
    latitude: z.number(),
    longitude: z.number(),
});
