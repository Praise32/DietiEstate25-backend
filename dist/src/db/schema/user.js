import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { posts } from "./posts.js";
export const roles = pgTable("roles", {
    id: serial().primaryKey(),
    name: text().notNull(),
});
const user = pgTable("users", {
    id: serial().primaryKey(),
    googleId: text("google_id"),
    name: text(),
    phone: text().unique(),
    email: text().unique(),
    password: text().notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
    roleId: serial("role_id").notNull().references(() => roles.id),
    agencyId: integer("agency_id"),
    hasCreatedAgency: boolean("has_created_agency").default(false),
});
export const userInserSchema = createInsertSchema(user, {
    email: schema => schema.email().nonempty(),
    phone: schema => schema.nonempty(),
    password: schema => schema.nonempty(),
    name: schema => schema.nonempty(),
}).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const userSelectSchema = createInsertSchema(user, {
    password: schema => schema.nonempty(),
}).omit({}).superRefine((data, context) => {
    if (!data.name && !data.email) {
        context.addIssue({
            code: z.ZodIssueCode.invalid_type,
            expected: "string",
            received: "undefined",
            path: ["name", "email"],
            message: "At least one of name or email must be provided",
        });
    }
});
export const userIdSchema = createSelectSchema(user).omit({
    name: true,
    phone: true,
    email: true,
    password: true,
    createdAt: true,
    updatedAt: true,
});
export const userLoginSchema = z.object({
    identifier: z.string().nonempty(),
    password: z.string().nonempty(),
});
export const usersRelations = relations(user, ({ many }) => ({
    posts: many(posts),
}));
export default user;
