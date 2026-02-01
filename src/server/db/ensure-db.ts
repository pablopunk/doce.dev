import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { ensureQueueSettingsRow } from "@/server/queue/queue.settings";
import { db } from "./client";
import { logger } from "@/server/logger";

let migrationsRan = false;

export async function ensureDatabaseReady() {
	if (migrationsRan) {
		return;
	}

	try {
		await migrate(db, { migrationsFolder: "./drizzle" });
		try {
			await ensureQueueSettingsRow();
		} catch (e) {
			logger.error({ e }, "[DB] Failed to ensure queue settings row");
		}
		migrationsRan = true;
	} catch (error) {
		logger.error({ error }, "[DB] Initialization failed");
		throw error;
	}
}
