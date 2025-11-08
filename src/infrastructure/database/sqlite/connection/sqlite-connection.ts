import Database from "better-sqlite3";
import { AppConfig } from "@/shared/config/app-config";
import { DatabaseError } from "@/shared/kernel/errors";
import { runMigrations } from "@/lib/migrations";

/**
 * SQLite Connection Singleton
 * Manages single database connection for the application
 */
class SQLiteConnection {
  private static instance: Database.Database | null = null;
  private static migrationsRun = false;

  static getInstance(): Database.Database {
    if (!this.instance) {
      try {
        const dbPath = AppConfig.getDatabasePath();
        this.instance = new Database(dbPath);
        
        // Enable foreign keys
        this.instance.pragma("foreign_keys = ON");
        
        // Run migrations on first connection (once per app lifecycle)
        if (!this.migrationsRun) {
          console.log("[DB] Running migrations...");
          runMigrations(this.instance);
          this.migrationsRun = true;
          console.log("[DB] Migrations complete");
        }
      } catch (error) {
        throw new DatabaseError(
          "Failed to connect to database",
          error instanceof Error ? error : undefined
        );
      }
    }

    return this.instance;
  }

  static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
      this.migrationsRun = false;
    }
  }
}

export const getDatabase = () => SQLiteConnection.getInstance();
export const closeDatabase = () => SQLiteConnection.close();
