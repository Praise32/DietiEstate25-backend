import { relations } from "drizzle-orm/relations";
import { users, comments, posts, photos, roles } from "./schema";

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

export const usersRelations = relations(users, ({one, many}) => ({
	comments: many(comments),
	posts: many(posts),
	photos: many(photos),
	role: one(roles, {
		fields: [users.roleId],
		references: [roles.id]
	}),
}));

export const postsRelations = relations(posts, ({one, many}) => ({
	comments: many(comments),
	user: one(users, {
		fields: [posts.userId],
		references: [users.id]
	}),
	photos: many(photos),
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

export const rolesRelations = relations(roles, ({many}) => ({
	users: many(users),
}));