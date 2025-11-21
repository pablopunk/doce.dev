/**
 * Drizzle database instance
 * Single source of truth for DB connection
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import env from "@/lib/env";
import * as schema from "./schema";

// Data directory is already created in env.ts
// Create better-sqlite3 instance
const sqlite = new Database(env.dbPath);
sqlite.pragma("journal_mode = WAL");

// Create Drizzle instance with schema
export const db = drizzle(sqlite, { schema });

// Export raw sqlite instance for advanced use cases
export default sqlite;
