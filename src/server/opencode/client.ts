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
function getOpencodeHostname(projectId: string): string {
	return `doce_${projectId}-opencode-1`;
}

/**
 * Get or create an opencode client for a project.
 * Uses the container hostname to connect within the Docker network.
 * Reuses existing client connections to avoid overhead.
 * Uses the v2 SDK client which includes all the latest API methods.
 */
export function getOpencodeClient(projectId: string): OpencodeClient {
	if (!clientCache.has(projectId)) {
		const baseUrl = `http://${getOpencodeHostname(projectId)}:3000`;
		logger.debug(
			{ projectId, baseUrl },
			"Creating opencode client using container hostname",
		);

		clientCache.set(
			projectId,
			createClient({
				baseUrl,
			}),
		);
	}

	return clientCache.get(projectId)!;
}

/**
 * Legacy function name - use getOpencodeClient instead.
 * @deprecated Use getOpencodeClient() for cached clients
 */
export function createOpencodeClient(projectId: string): OpencodeClient {
	return getOpencodeClient(projectId);
}

/**
 * Clear cached client for a project (typically called during project cleanup).
 */
export function clearOpencodeClientCache(projectId: string): void {
	if (clientCache.has(projectId)) {
		logger.debug({ projectId }, "Clearing opencode client cache");
		clientCache.delete(projectId);
	}
}

/**
 * Check if opencode server is healthy using the SDK client.
 */
export async function isOpencodeHealthy(projectId: string): Promise<boolean> {
	try {
		const client = createOpencodeClient(projectId);
		const response = await client.global.health();
		return response.response.ok;
	} catch {
		// Fallback to direct fetch if SDK method fails
		try {
			const hostname = getOpencodeHostname(projectId);
			const response = await fetch(`http://${hostname}:3000/doc`, {
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
