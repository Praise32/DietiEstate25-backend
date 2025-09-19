import { relations } from "drizzle-orm";
import { 
  integer, 
  pgEnum,
  pgTable, 
  serial, 
  text, 
  timestamp 
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { posts } from "./posts";
import user from "./user";

// Definizione dello stato dell'appuntamento
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending", 
  "confirmed", 
  "rejected"
]);

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => user.id),
  agentId: integer("agent_id").notNull().references(() => user.id),
  requestedDate: timestamp("requested_date").notNull(),
  status: appointmentStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relazioni
export const appointmentsRelations = relations(appointments, ({ one }) => ({
  post: one(posts, {
    fields: [appointments.postId],
    references: [posts.id],
  }),
  user: one(user, {
    fields: [appointments.userId],
    references: [user.id],
    relationName: "userAppointments",
  }),
  agent: one(user, {
    fields: [appointments.agentId],
    references: [user.id],
    relationName: "agentAppointments",
  }),
}));

// Validazione con Zod
export const appointmentInsertSchema = createInsertSchema(appointments, {
  requestedDate: z.coerce.date(),
  notes: z.string().optional(),
});

export const appointmentSelectSchema = createSelectSchema(appointments);

export const appointmentStatusUpdateSchema = z.object({
  status: z.enum(["confirmed", "rejected"]),
  notes: z.string().optional(),
});

export const appointmentIdSchema = z.object({
  id: z.coerce.number().int(),
});


// Crea un nuovo schema per l'API che omette i campi aggiunti dal server
export const appointmentApiSchema = appointmentInsertSchema.omit({
  userId: true,
  agentId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  id: true
}).refine(
  data => {
    const requestedDate = new Date(data.requestedDate);
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    return requestedDate <= twoWeeksFromNow;
  },
  { message: "La data dell'appuntamento deve essere entro le prossime due settimane" }
);


export type AppointmentApiSchema = z.infer<typeof appointmentApiSchema>;
export type AppointmentInsertSchema = z.infer<typeof appointmentInsertSchema>;
export type AppointmentSelectSchema = z.infer<typeof appointmentSelectSchema>;
export type AppointmentStatusUpdateSchema = z.infer<typeof appointmentStatusUpdateSchema>;
export type AppointmentIdSchema = z.infer<typeof appointmentIdSchema>;