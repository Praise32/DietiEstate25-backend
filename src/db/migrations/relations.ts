import { relations } from "drizzle-orm/relations";
import { roles, users, agencies, posts, photos, invites, comments } from "./schema";

export const usersRelations = relations(users, ({one, many}) => ({
	role: one(roles, {
		fields: [users.roleId],
		references: [roles.id]
	}),
	agencies: many(agencies),
	posts: many(posts),
	photos: many(photos),
	invites: many(invites),
	comments: many(comments),
}));

export const rolesRelations = relations(roles, ({many}) => ({
	users: many(users),
}));

export const agenciesRelations = relations(agencies, ({one}) => ({
	user: one(users, {
		fields: [agencies.managerId],
		references: [users.id]
	}),
}));

export const postsRelations = relations(posts, ({one, many}) => ({
	user: one(users, {
		fields: [posts.userId],
		references: [users.id]
	}),
	photos: many(photos),
	comments: many(comments),
}));

export const photosRelations = relations(photos, ({one}) => ({
	user: one(users, {
		fields: [photos.userId],
		references: [users.id]
	}),
	post: one(posts, {
		fields: [photos.postsId],
		references: [posts.id]
	}),
}));

export const invitesRelations = relations(invites, ({one}) => ({
	user: one(users, {
		fields: [invites.invitedBy],
		references: [users.id]
	}),
}));

export const commentsRelations = relations(comments, ({one}) => ({
	user: one(users, {
		fields: [comments.userId],
		references: [users.id]
	}),
	post: one(posts, {
		fields: [comments.postId],
		references: [posts.id]
	}),
}));