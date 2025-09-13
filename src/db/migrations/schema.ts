import { pgTable, foreignKey, serial, text, timestamp, integer, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



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

export const posts = pgTable("posts", {
	id: serial().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	latitude: text(),
	longitude: text(),
	address: text().notNull(),
	city: text().notNull(),
	cap: integer().notNull(),
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

export const roles = pgTable("roles", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
});

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	name: text(),
	phone: text().notNull(),
	email: text(),
	password: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	roleId: serial("role_id").notNull(),
	googleId: text("google_id"),
}, (table) => [
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [roles.id],
			name: "users_role_id_roles_id_fk"
		}),
	unique("users_phone_unique").on(table.phone),
	unique("users_email_unique").on(table.email),
]);
