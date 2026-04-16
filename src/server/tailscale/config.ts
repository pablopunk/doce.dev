import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { instanceSettings } from "@/server/db/schema";
import { ensureInstanceSettingsRow } from "@/server/settings/instance.settings";

const INSTANCE_SETTINGS_ROW_ID = 1;

export interface TailscaleConfig {
	enabled: boolean;
	authKey: string | null;
	hostname: string | null;
	tailnetName: string | null;
}

export async function getTailscaleConfig(): Promise<TailscaleConfig> {
	await ensureInstanceSettingsRow();

	const result = await db
		.select({
			enabled: instanceSettings.tailscaleEnabled,
			authKey: instanceSettings.tailscaleAuthKey,
			hostname: instanceSettings.tailscaleHostname,
			tailnetName: instanceSettings.tailscaleTailnetName,
		})
		.from(instanceSettings)
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ROW_ID))
		.limit(1);

	const row = result[0];
	return {
		enabled: row?.enabled ?? false,
		authKey: row?.authKey ?? null,
		hostname: row?.hostname ?? null,
		tailnetName: row?.tailnetName ?? null,
	};
}

export async function setTailscaleConfig(
	config: Partial<TailscaleConfig>,
): Promise<void> {
	await ensureInstanceSettingsRow();

	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (config.enabled !== undefined) {
		updates.tailscaleEnabled = config.enabled;
	}
	if (config.authKey !== undefined) {
		updates.tailscaleAuthKey = config.authKey;
	}
	if (config.hostname !== undefined) {
		updates.tailscaleHostname = config.hostname;
	}
	if (config.tailnetName !== undefined) {
		updates.tailscaleTailnetName = config.tailnetName;
	}

	await db
		.update(instanceSettings)
		.set(updates)
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ROW_ID));
}
