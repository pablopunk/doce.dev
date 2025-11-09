import Database from "better-sqlite3";
import { runMigrations } from "@/lib/migrations";
import { AppConfig } from "@/shared/config/app-config";
import { DatabaseError } from "@/shared/kernel/errors";

/**
 * SQLite Connection Singleton
 * Manages single database connection for the application
 */
class SQLiteConnection {
	private static instance: Database.Database | null = null;
	private static migrationsRun = false;

	static getInstance(): Database.Database {
		if (!SQLiteConnection.instance) {
			try {
				const dbPath = AppConfig.getDatabasePath();
				SQLiteConnection.instance = new Database(dbPath);

				// Enable foreign keys
				SQLiteConnection.instance.pragma("foreign_keys = ON");

				// Run migrations on first connection (once per app lifecycle)
				if (!SQLiteConnection.migrationsRun) {
					console.log("[DB] Running migrations...");
					runMigrations(SQLiteConnection.instance);
					SQLiteConnection.migrationsRun = true;
					console.log("[DB] Migrations complete");
				}
			} catch (error) {
				throw new DatabaseError(
					"Failed to connect to database",
					error instanceof Error ? error : undefined,
				);
			}
		}

		return SQLiteConnection.instance;
	}

	static close(): void {
		if (SQLiteConnection.instance) {
			SQLiteConnection.instance.close();
			SQLiteConnection.instance = null;
			SQLiteConnection.migrationsRun = false;
		}
	}
}

export const getDatabase = () => SQLiteConnection.getInstance();
export const closeDatabase = () => SQLiteConnection.close();
