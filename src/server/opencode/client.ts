import {
	createOpencodeClient as createClient,
	type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";

import { logger } from "@/server/logger";

// Cache clients by port to avoid recreating connections
const clientCache = new Map<number, OpencodeClient>();

/**
 * Get or create an opencode client for a project port.
 * Reuses existing client connections to avoid overhead.
 * Uses the v2 SDK client which includes all the latest API methods.
 */
export function getOpencodeClient(opencodePort: number): OpencodeClient {
	if (!clientCache.has(opencodePort)) {
		const baseUrl = `http://127.0.0.1:${opencodePort}`;
		logger.debug({ baseUrl }, "Creating and caching opencode client");

		clientCache.set(
			opencodePort,
			createClient({
				baseUrl,
			}),
		);
	}

	return clientCache.get(opencodePort)!;
}

/**
 * Legacy function name - use getOpencodeClient instead.
 * @deprecated Use getOpencodeClient() for cached clients
 */
export function createOpencodeClient(opencodePort: number): OpencodeClient {
	return getOpencodeClient(opencodePort);
}

/**
 * Clear cached client for a port (typically called during project cleanup).
 */
export function clearOpencodeClientCache(opencodePort: number): void {
	if (clientCache.has(opencodePort)) {
		logger.debug({ opencodePort }, "Clearing opencode client cache");
		clientCache.delete(opencodePort);
	}
}

/**
 * Check if opencode server is healthy using the SDK client.
 */
export async function isOpencodeHealthy(
	opencodePort: number,
): Promise<boolean> {
	try {
		const client = createOpencodeClient(opencodePort);
		const response = await client.global.health();
		return response.response.ok;
	} catch {
		// Fallback to direct fetch if SDK method fails
		try {
			const response = await fetch(`http://127.0.0.1:${opencodePort}/doc`, {
				method: "GET",
				signal: AbortSignal.timeout(2000),
			});
			return response.status === 200;
		} catch {
			return false;
		}
	}
}

export type { OpencodeClient };
