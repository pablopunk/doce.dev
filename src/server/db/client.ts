import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// Lazily initialized database connection
// This allows the config system to be initialized first
let _sqlite: Database.Database | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDbPath(): string {
	// Use process.env directly for backwards compatibility
	// The config system will have initialized this value
	return process.env.DB_FILE_NAME ?? "data/db.sqlite";
}

function ensureInitialized(): void {
	if (_sqlite && _db) return;

	const DB_PATH = getDbPath();

	// Ensure data directory exists
	const dbDir = dirname(DB_PATH);
	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true });
	}

	_sqlite = new Database(DB_PATH);

	// Enable WAL mode for better concurrent performance
	_sqlite.pragma("journal_mode = WAL");

	_db = drizzle(_sqlite, { schema });
}

// Export getter functions that ensure initialization
export function getSqlite(): Database.Database {
	ensureInitialized();
	return _sqlite!;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
	ensureInitialized();
	return _db!;
}

// Backwards-compatible exports (maintain existing API)
export const sqlite = new Proxy({} as Database.Database, {
	get(_, prop) {
		return getSqlite()[prop as keyof Database.Database];
	},
});

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(_, prop) {
		return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>];
	},
});
