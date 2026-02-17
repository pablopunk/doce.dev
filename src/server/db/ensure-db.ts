import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { logger } from "@/server/logger";
import { ensureQueueSettingsRow } from "@/server/queue/queue.settings";
import { db } from "./client";

let migrationsRan = false;

function isBenignAlreadyExistsError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	const cause =
		error && typeof error === "object" && "cause" in error
			? String((error as { cause?: unknown }).cause).toLowerCase()
			: "";

	const combined = `${message} ${cause}`;
	return (
		combined.includes("table") &&
		combined.includes("already exists") &&
		combined.includes("projects")
	);
}

export async function ensureDatabaseReady() {
	if (migrationsRan) {
		return;
	}

	try {
		try {
			await migrate(db, { migrationsFolder: "./drizzle" });
		} catch (error) {
			if (!isBenignAlreadyExistsError(error)) {
				throw error;
			}

			logger.warn(
				"[DB] Migration metadata appears out of sync; continuing because schema already exists",
			);
		}

		await ensureQueueSettingsRow();
		migrationsRan = true;
	} catch (error) {
		logger.error({ error }, "[DB] Initialization failed");
		throw error;
	}
}
