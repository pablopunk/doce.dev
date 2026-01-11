import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";
import { ensureQueueSettingsRow } from "@/server/queue/queue.settings";

let migrationsRan = false;

export async function ensureDatabaseReady() {
	if (migrationsRan) {
		return;
	}

	try {
		await migrate(db, { migrationsFolder: "./drizzle" });
		await ensureQueueSettingsRow();
		migrationsRan = true;
	} catch (error) {
		console.error("[DB] Initialization failed:", error);
		throw error;
	}
}
