import { eq } from "drizzle-orm";
import { db, sqlite } from "@/server/db/client";
import { instanceSettings } from "@/server/db/schema";

const INSTANCE_SETTINGS_ROW_ID = 1;

function isMissingInstanceSettingsTableError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const message = error.message.toLowerCase();
	return (
		message.includes("no such table") && message.includes("instance_settings")
	);
}

function ensureInstanceSettingsTableExists(): void {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS instance_settings (
			id integer PRIMARY KEY NOT NULL,
			base_url text,
			tailscale_enabled integer NOT NULL DEFAULT 0,
			tailscale_auth_key text,
			tailscale_hostname text,
			tailscale_tailnet_name text,
			updated_at integer NOT NULL
		)
	`);

	// Add columns if they don't exist (for existing databases)
	const addColumnIfMissing = (col: string, def: string) => {
		try {
			sqlite.exec(`ALTER TABLE instance_settings ADD COLUMN ${col} ${def}`);
		} catch {
			// Column already exists
		}
	};
	addColumnIfMissing("tailscale_enabled", "integer NOT NULL DEFAULT 0");
	addColumnIfMissing("tailscale_auth_key", "text");
	addColumnIfMissing("tailscale_hostname", "text");
	addColumnIfMissing("tailscale_tailnet_name", "text");
}

async function selectExistingSettingsRows(): Promise<Array<{ id: number }>> {
	return db
		.select({ id: instanceSettings.id })
		.from(instanceSettings)
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ROW_ID))
		.limit(1);
}

export async function ensureInstanceSettingsRow(): Promise<void> {
	let existing: Array<{ id: number }>;

	try {
		existing = await selectExistingSettingsRows();
	} catch (error) {
		if (!isMissingInstanceSettingsTableError(error)) {
			throw error;
		}

		ensureInstanceSettingsTableExists();
		existing = await selectExistingSettingsRows();
	}

	if (existing.length > 0) {
		return;
	}

	await db.insert(instanceSettings).values({
		id: INSTANCE_SETTINGS_ROW_ID,
		baseUrl: null,
		updatedAt: new Date(),
	});
}

export async function getInstanceBaseUrl(): Promise<string | null> {
	await ensureInstanceSettingsRow();

	const result = await db
		.select({ baseUrl: instanceSettings.baseUrl })
		.from(instanceSettings)
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ROW_ID))
		.limit(1);

	return result[0]?.baseUrl ?? null;
}

export async function setInstanceBaseUrl(
	baseUrl: string | null,
): Promise<void> {
	await ensureInstanceSettingsRow();

	await db
		.update(instanceSettings)
		.set({ baseUrl, updatedAt: new Date() })
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ROW_ID));
}
