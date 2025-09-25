import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  PgColumn,
  pgTable,
  PgTableWithColumns,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSchemaFactory, createUpdateSchema } from "drizzle-zod";
import z from "zod";

import { posts } from "./posts";
import user from "./user";

export const agencies = pgTable("agencies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  cap: text("cap").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  logo: text("logo"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
  managerId: integer("manager_id").references(() => user.id),
});

export const agenciesRelations = relations(agencies, ({ one, many }) => ({
  manager: one(user, {
    fields: [agencies.managerId],
    references: [user.id],
    relationName: "agencies",
  }),

  // Relazione con gli agenti dell'agenzia (via user.agencyId)
  agents: many(user),
  // Relazione con gli immobili dell'agenzia
  properties: many(posts),
}));

const { createSelectSchema } = createSchemaFactory({
  coerce: true, // <-- IMPORTANTE: Questa opzione converte automaticamente i tipi
});

// Schema per l'ID dell'agenzia
export const agenciesIdSchema = createSelectSchema(agencies)
  .omit({
    name: true,
    address: true,
    city: true,
    cap: true,
    phone: true,
    email: true,
    website: true,
    logo: true,
    description: true,
    createdAt: true,
    updatedAt: true,
    managerId: true,

  });

// Schema per l'inserimento di una nuova agenzia
export const agenciesInsertSchema = createInsertSchema(agencies)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Il nome è obbligatorio"),
    address: z.string().min(1, "L'indirizzo è obbligatorio"),
    city: z.string().min(1, "La città è obbligatoria"),
    cap: z.string().min(1, "Il CAP è obbligatorio"),
    phone: z.string().min(1, "Il numero di telefono è obbligatorio"),
    email: z.string().email("Inserire un indirizzo email valido"),
  });

// Schema per l'aggiornamento di un'agenzia esistente
export const agenciesUpdateSchema = createUpdateSchema(agencies)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    email: z.string().email("Inserire un indirizzo email valido").optional(),
  })
  .superRefine((data, context) => {
    if (Object.keys(data).length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "È necessario specificare almeno un campo da aggiornare",
      });
    }
  });

// Esporta i tipi
export type AgenciesInsertSchema = z.infer<typeof agenciesInsertSchema>;
export type AgenciesUpdateSchema = z.infer<typeof agenciesUpdateSchema>;
export type AgenciesIdSchema = z.infer<typeof agenciesIdSchema>;
