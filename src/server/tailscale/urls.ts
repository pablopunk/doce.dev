import { getTailscaleConfig } from "./config";

let cachedConfig: {
	enabled: boolean;
	tailnetName: string | null;
} | null = null;

let cacheExpiry = 0;

const CACHE_TTL_MS = 30_000;

async function getCachedConfig() {
	const now = Date.now();
	if (cachedConfig && now < cacheExpiry) {
		return cachedConfig;
	}

	const config = await getTailscaleConfig();
	cachedConfig = {
		enabled: config.enabled,
		tailnetName: config.tailnetName,
	};
	cacheExpiry = now + CACHE_TTL_MS;
	return cachedConfig;
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
	cachedConfig = null;
	cacheExpiry = 0;
}
