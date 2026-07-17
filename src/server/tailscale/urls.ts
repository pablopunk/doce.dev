import { getOrSet, invalidate } from "@/server/cache/memory";
import { getTailscaleConfig } from "./config";

const URL_CONFIG_CACHE_KEY = "tailscale:url-config";
const CACHE_TTL_MS = 30_000;

interface UrlConfig {
	enabled: boolean;
	tailnetName: string | null;
}

function getCachedConfig(): Promise<UrlConfig> {
	return getOrSet(URL_CONFIG_CACHE_KEY, { ttlMs: CACHE_TTL_MS }, async () => {
		const config = await getTailscaleConfig();
		return {
			enabled: config.enabled,
			tailnetName: config.tailnetName,
		};
	});
}

/**
 * Build the Tailscale HTTPS URL for a project.
 * Includes a 5-char hash from projectId to avoid hostname collisions.
 * Returns null if Tailscale is not enabled.
 */
export async function getTailscaleProjectUrl(
	slug: string,
	variant: "preview" | "production",
	projectId: string,
): Promise<string | null> {
	const config = await getCachedConfig();
	if (!config.enabled || !config.tailnetName) {
		return null;
	}

	const shortId = projectId.slice(0, 5);
	const hostname =
		variant === "preview" ? `${slug}-${shortId}-preview` : `${slug}-${shortId}`;

	return `https://${hostname}.${config.tailnetName}`;
}

/**
 * Build the Tailscale HTTPS URL for the main doce app.
 * Returns null if Tailscale is not enabled.
 */
export async function getTailscaleAppUrl(): Promise<string | null> {
	const config = await getCachedConfig();
	if (!config.enabled || !config.tailnetName) {
		return null;
	}

	const tsConfig = await getTailscaleConfig();
	const hostname = tsConfig.hostname ?? "doce";

	return `https://${hostname}.${config.tailnetName}`;
}

/** Invalidate the cached config (call after connect/disconnect). */
export function invalidateTailscaleUrlCache(): void {
	invalidate(URL_CONFIG_CACHE_KEY);
}
