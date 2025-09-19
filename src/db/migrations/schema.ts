import { pgTable, foreignKey, unique, serial, text, timestamp, integer, numeric, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const listingType = pgEnum("listing_type", ['vendita', 'affitto'])


export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	googleId: text("google_id"),
	name: text(),
	phone: text().notNull(),
	email: text(),
	password: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	roleId: serial("role_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "users_role_id_roles_id_fk"
		}),
	unique("users_phone_unique").on(table.phone),
	unique("users_email_unique").on(table.email),
]);

export const roles = pgTable("roles", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
});

export const agencies = pgTable("agencies", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	address: text().notNull(),
	managerId: integer("manager_id"),
}, (table) => [
	foreignKey({
			columns: [table.managerId],
			foreignColumns: [users.id],
			name: "agencies_manager_id_users_id_fk"
		}),
]);

export const posts = pgTable("posts", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	// TODO: failed to parse database type 'geography'
	location: unknown("location").notNull(),
	address: text().notNull(),
	city: text().notNull(),
	cap: integer().notNull(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	listingType: listingType("listing_type").notNull(),
	rooms: integer(),
	size: integer(),
	floor: integer(),
	hasElevator: boolean("has_elevator").default(false),
	energyClass: text("energy_class"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	userId: serial("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "posts_user_id_users_id_fk"
		}),
]);

export const photos = pgTable("photos", {
	id: serial().primaryKey().notNull(),
	url: text().notNull(),
	filename: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	userId: serial("user_id").notNull(),
	postsId: serial("posts_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "photos_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.postsId],
			foreignColumns: [posts.id],
			name: "photos_posts_id_posts_id_fk"
		}).onDelete("cascade"),
]);

export const invites = pgTable("invites", {
	id: serial().primaryKey().notNull(),
	email: text().notNull(),
	role: text().notNull(),
	token: text().notNull(),
	invitedBy: integer("invited_by").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	used: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [users.id],
			name: "invites_invited_by_users_id_fk"
		}),
]);

export const comments = pgTable("comments", {
	id: serial().primaryKey().notNull(),
	text: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	userId: serial("user_id").notNull(),
	postId: serial("post_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "comments_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "comments_post_id_posts_id_fk"
		}).onDelete("cascade"),
]);
