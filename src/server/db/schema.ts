import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Users table - single admin user
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  passwordHash: text("password_hash").notNull(),
});

// Sessions table - DB-backed sessions
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

// User settings table - OpenRouter config
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  openrouterApiKey: text("openrouter_api_key"),
  defaultModel: text("default_model"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Projects table
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  prompt: text("prompt").notNull(),
  model: text("model"),
  devPort: integer("dev_port").notNull(),
  opencodePort: integer("opencode_port").notNull(),
  status: text("status", {
    enum: ["created", "starting", "running", "stopping", "stopped", "error"],
  })
    .notNull()
    .default("created"),
  pathOnDisk: text("path_on_disk").notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
