import { relations } from "drizzle-orm/relations";
import { projects, sessions, userSettings, users } from "./schema";

export const projectsRelations = relations(projects, ({ one }) => ({
	user: one(users, {
		fields: [projects.ownerUserId],
		references: [users.id],
	}),
}));

export const usersRelations = relations(users, ({ many }) => ({
	projects: many(projects),
	sessions: many(sessions),
	userSettings: many(userSettings),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
	user: one(users, {
		fields: [userSettings.userId],
		references: [users.id],
	}),
}));
