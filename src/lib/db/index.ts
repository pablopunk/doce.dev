/**
 * Database abstraction layer
 *
 * Clean re-exports of Drizzle ORM providers.
 * Preferred usage: import * as db from "@/lib/db"
 */

import * as drizzle from "./providers/drizzle/index";

// Export schema types (use verbose names like ProjectInDatabase)
export * from "./providers/drizzle/schema";

// Export namespaced operations
export const config = drizzle.config;
export const users = drizzle.users;
export const projects = drizzle.projects;
export const conversations = drizzle.conversations;
export const messages = drizzle.messages;
export const deployments = drizzle.deployments;

// Export raw database and Drizzle instance for advanced queries
export const db = drizzle.db;
export const sqlite = drizzle.sqlite;
