/**
 * Drizzle ORM Schema
 *
 * Pure database schema definitions - no business logic
 */

import { sql } from "drizzle-orm";
import { text, sqliteTable } from "drizzle-orm/sqlite-core";

// Config table
export const config = sqliteTable("config", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Users table
export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	username: text("username").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Projects table
export const projects = sqliteTable("projects", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
	userId: text("user_id"),
	status: text("status").default("draft"),
	previewUrl: text("preview_url"),
	deployedUrl: text("deployed_url"),
	buildLogs: text("build_logs"),
});

// Conversations table
export const conversations = sqliteTable("conversations", {
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	model: text("model").default("anthropic/claude-4.5-sonnet"),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Messages table
export const messages = sqliteTable("messages", {
	id: text("id").primaryKey(),
	conversationId: text("conversation_id")
		.notNull()
		.references(() => conversations.id, { onDelete: "cascade" }),
	role: text("role").notNull(),
	content: text("content").notNull(),
	streamingStatus: text("streaming_status").default("complete"),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Deployments table
export const deployments = sqliteTable("deployments", {
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => projects.id, { onDelete: "cascade" }),
	containerId: text("container_id"),
	url: text("url").notNull(),
	status: text("status").default("building"),
	createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

// Raw database types - use domain model types instead (e.g., import type { Project } from "@/domain/projects/models/project")
export type ConfigInDatabase = typeof config.$inferSelect;
export type UserInDatabase = typeof users.$inferSelect;
export type ProjectInDatabase = typeof projects.$inferSelect;
export type ConversationInDatabase = typeof conversations.$inferSelect;
export type MessageInDatabase = typeof messages.$inferSelect;
export type DeploymentInDatabase = typeof deployments.$inferSelect;

export type NewConfigInDatabase = typeof config.$inferInsert;
export type NewUserInDatabase = typeof users.$inferInsert;
export type NewProjectInDatabase = typeof projects.$inferInsert;
export type NewConversationInDatabase = typeof conversations.$inferInsert;
export type NewMessageInDatabase = typeof messages.$inferInsert;
export type NewDeploymentInDatabase = typeof deployments.$inferInsert;
