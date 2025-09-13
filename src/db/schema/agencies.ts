import { type z } from "zod";

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSchemaFactory, createUpdateSchema } from "drizzle-zod";

import user from "./user";

export const agencies = pgTable("agencies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  managerId: integer("manager_id").references(() => user.id),
});


export const agenciesRelations = relations(agencies, ({ one }) => ({
    manager: one(user, {
    fields: [agencies.managerId],
    references: [user.id],
    relationName: 'agencies',
     }),
}));

const { createSelectSchema } = createSchemaFactory({
  coerce: true,
});

export const agenciesIdSchema = createSelectSchema(agencies).omit({

    
});

export const agenciesInsertSchema = createInsertSchema(agencies, {
  
});

export const agenciesUpdateSchema = createUpdateSchema(agencies).omit({
  id: true,
}).superRefine((data, context) => {
  if (Object.keys(data).length === 0) {
    context.addIssue({
      code: "custom",
      message: "agencies data is required and must have at least one value",
    });
  }
});

export type agenciesInsertSchema = z.infer<typeof agenciesInsertSchema>;
export type agenciesUpdateSchema = z.infer<typeof agenciesUpdateSchema>;
export type agenciesIdSchema = z.infer<typeof agenciesIdSchema>;
