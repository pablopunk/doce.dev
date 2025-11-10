import type Database from "better-sqlite3";

/**
 * Database migrations
 * Each migration is run once and tracked in a migrations table
 */

interface Migration {
	id: number;
	name: string;
	up: (db: Database.Database) => void;
}

const migrations: Migration[] = [
	{
		id: 1,
		name: "add_model_to_conversations",
		up: (db) => {
			// Add model column to conversations table
			db.exec(`
        ALTER TABLE conversations ADD COLUMN model TEXT DEFAULT 'openai/gpt-4.1-mini';
      `);
		},
	},
	{
		id: 2,
		name: "add_build_logs_to_projects",
		up: (db) => {
			// Add build_logs column to projects table to store docker-compose output
			db.exec(`
        ALTER TABLE projects ADD COLUMN build_logs TEXT;
      `);
		},
	},
	{
		id: 3,
		name: "add_streaming_status_to_messages",
		up: (db) => {
			// Add streaming_status column to messages table
			// Possible values: 'streaming', 'complete', 'error'
			db.exec(`
        ALTER TABLE messages ADD COLUMN streaming_status TEXT DEFAULT 'complete';
      `);
		},
	},
];

export function runMigrations(db: Database.Database) {
	// Create migrations table if it doesn't exist
	db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

	// Get applied migrations
	const appliedMigrations = db.prepare("SELECT id FROM migrations").all() as {
		id: number;
	}[];
	const appliedIds = new Set(appliedMigrations.map((m) => m.id));

	// Run pending migrations
	for (const migration of migrations) {
		if (!appliedIds.has(migration.id)) {
			console.log(`Running migration: ${migration.name}`);
			try {
				migration.up(db);
				db.prepare("INSERT INTO migrations (id, name) VALUES (?, ?)").run(
					migration.id,
					migration.name,
				);
				console.log(`✓ Migration ${migration.name} completed`);
			} catch (error) {
				// Check if error is because column already exists
				if (
					error instanceof Error &&
					error.message.includes("duplicate column name")
				) {
					console.log(
						`Migration ${migration.name} already applied (column exists)`,
					);
					// Mark as applied anyway
					db.prepare("INSERT INTO migrations (id, name) VALUES (?, ?)").run(
						migration.id,
						migration.name,
					);
				} else {
					console.error(`✗ Migration ${migration.name} failed:`, error);
					throw error;
				}
			}
		}
	}
}
