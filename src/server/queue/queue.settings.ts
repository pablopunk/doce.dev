import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { queueSettings } from "@/server/db/schema";

const QUEUE_SETTINGS_ROW_ID = 1;

export async function ensureQueueSettingsRow(): Promise<void> {
	const existing = await db
		.select({ id: queueSettings.id })
		.from(queueSettings)
		.where(eq(queueSettings.id, QUEUE_SETTINGS_ROW_ID))
		.limit(1);

	if (existing.length > 0) {
		return;
	}

	await db.insert(queueSettings).values({
		id: QUEUE_SETTINGS_ROW_ID,
		paused: false,
		updatedAt: new Date(),
	});
}

export async function isQueuePaused(): Promise<boolean> {
	await ensureQueueSettingsRow();

	const result = await db
		.select({ paused: queueSettings.paused })
		.from(queueSettings)
		.where(eq(queueSettings.id, QUEUE_SETTINGS_ROW_ID))
		.limit(1);

	return result[0]?.paused ?? false;
}

export async function setQueuePaused(paused: boolean): Promise<void> {
	await ensureQueueSettingsRow();

	await db
		.update(queueSettings)
		.set({ paused, updatedAt: new Date() })
		.where(eq(queueSettings.id, QUEUE_SETTINGS_ROW_ID));
}

export async function getConcurrency(): Promise<number> {
	await ensureQueueSettingsRow();

	const result = await db
		.select({ concurrency: queueSettings.concurrency })
		.from(queueSettings)
		.where(eq(queueSettings.id, QUEUE_SETTINGS_ROW_ID))
		.limit(1);

	return result[0]?.concurrency ?? 2;
}

export async function setConcurrency(concurrency: number): Promise<void> {
	await ensureQueueSettingsRow();

	await db
		.update(queueSettings)
		.set({ concurrency, updatedAt: new Date() })
		.where(eq(queueSettings.id, QUEUE_SETTINGS_ROW_ID));
}
