import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSchemaFactory, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { agencies } from "./agencies";
import user from "./user";

export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  token: text("token").notNull(),
  invitedBy: integer("invited_by").references(() => user.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  agencyId: integer("agency_id").references(() => agencies.id),
});

export const invitesRelations = relations(invites, ({ one }) => ({
  inviter: one(user, {
    fields: [invites.invitedBy],
    references: [user.id],
    relationName: "invites",
  }),
  agency: one(agencies, {
    fields: [invites.agencyId],
    references: [agencies.id],
    relationName: "invites_agency",
  }),
}));

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["agent", "support", "manager"]),
  agencyId: z.number().optional(),
});

const { createSelectSchema } = createSchemaFactory({
  coerce: true,
});

export const invitesIdSchema = createSelectSchema(invites).omit({
  email: true,

});

export const invitesInsertSchema = createInsertSchema(invites, {

});

export const invitesUpdateSchema = createUpdateSchema(invites).omit({
  createdAt: true,
  id: true,
}).superRefine((data, context) => {
  if (Object.keys(data).length === 0) {
    context.addIssue({
      code: "custom",
      message: "invites data is required and must have at least one value",
    });
  }
});

export type InvitesInsertSchema = z.infer<typeof invitesInsertSchema>;
export type InvitesUpdateSchema = z.infer<typeof invitesUpdateSchema>;
export type InvitesIdSchema = z.infer<typeof invitesIdSchema>;
