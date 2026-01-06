import { relations } from "drizzle-orm";
import { agencies } from "./agencies.js";
import { posts } from "./posts.js";
import user, { roles } from "./user.js";
export const usersRelations = relations(user, ({ one, many }) => ({
    posts: many(posts),
    agency: one(agencies, {
        fields: [user.agencyId],
        references: [agencies.id],
    }),
    role: one(roles, {
        fields: [user.roleId],
        references: [roles.id],
    }),
}));
export const agenciesRelations = relations(agencies, ({ one, many }) => ({
    manager: one(user, {
        fields: [agencies.managerId],
        references: [user.id],
        relationName: "agency_manager",
    }),
    agents: many(user, {
        relationName: "agency_agents",
    }),
    properties: many(posts, {
        relationName: "agency_properties",
    }),
}));
