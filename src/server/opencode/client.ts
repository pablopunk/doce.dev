import {
	createOpencodeClient as createClient,
	type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";

import { logger } from "@/server/logger";

// Cache clients by projectId to avoid recreating connections
const clientCache = new Map<string, OpencodeClient>();

/**
 * Get the container hostname for the opencode service.
 * Uses the docker-compose service name which is accessible within the shared network.
 */
function getOpencodeHostname(projectId: string | number): string {
	return `doce_${projectId}-opencode-1`;
}

/**
 * Get or create an opencode client for a project.
 * Uses the container hostname to connect within the Docker network.
 * Reuses existing client connections to avoid overhead.
 * Uses the v2 SDK client which includes all the latest API methods.
 */
export function getOpencodeClient(
	projectIdOrPort: string | number,
): OpencodeClient {
	// Support both old (port) and new (projectId) calling conventions
	let cacheKey: string;
	let baseUrl: string;

	if (typeof projectIdOrPort === "string") {
		// New: called with projectId
		cacheKey = projectIdOrPort;
		baseUrl = `http://${getOpencodeHostname(projectIdOrPort)}:3000`;
		logger.debug(
			{ projectId: projectIdOrPort, baseUrl },
			"Creating opencode client using container hostname",
		);
	} else {
		// Old: called with port (fallback for compatibility with localhost)
		const port = projectIdOrPort;
		cacheKey = `port_${port}`;
		baseUrl = `http://127.0.0.1:${port}`;
		logger.debug(
			{ port, baseUrl },
			"Creating opencode client using localhost (fallback)",
		);
	}

	if (!clientCache.has(cacheKey)) {
		clientCache.set(
			cacheKey,
			createClient({
				baseUrl,
			}),
		);
	}

	return clientCache.get(cacheKey)!;
}

/**
 * Legacy function name - use getOpencodeClient instead.
 * Supports both projectId (string) and port (number) for backwards compatibility.
 * @deprecated Use getOpencodeClient() for cached clients
 */
export function createOpencodeClient(
	projectIdOrPort: string | number,
): OpencodeClient {
	return getOpencodeClient(projectIdOrPort);
}

/**
 * Clear cached client for a project (typically called during project cleanup).
 */
export function clearOpencodeClientCache(
	projectIdOrPort: string | number,
): void {
	const cacheKey =
		typeof projectIdOrPort === "string"
			? projectIdOrPort
			: `port_${projectIdOrPort}`;

	if (clientCache.has(cacheKey)) {
		logger.debug({ cacheKey }, "Clearing opencode client cache");
		clientCache.delete(cacheKey);
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
