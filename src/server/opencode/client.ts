import {
	createOpencodeClient as createClient,
	type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";

import { Effect } from "effect";
import { logger } from "@/server/logger";
import { isRunningInDocker } from "@/server/utils/docker";

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
 * Get the base URL for connecting to an OpenCode server.
 *
 * - When running inside Docker (DOCE_NETWORK set): uses container hostname
 * - When running on host (dev mode): uses localhost with the project's opencodePort
 *
 * @param projectId The project ID
 * @param opencodePort Optional port number for dev mode (required when not in Docker)
 */
export function getOpencodeBaseUrl(
	projectId: string,
	opencodePort?: number,
): string {
	if (isRunningInDocker()) {
		return `http://${getOpencodeHostname(projectId)}:3000`;
	}

	// Dev mode - use localhost with the project's port
	if (!opencodePort) {
		throw new Error(
			`opencodePort is required when running in dev mode (not in Docker). Project: ${projectId}`,
		);
	}
	return `http://localhost:${opencodePort}`;
}

/**
 * Get or create an opencode client for a project.
 * Uses the container hostname when running in Docker, or localhost:port in dev mode.
 * Reuses existing client connections to avoid overhead.
 * Uses the v2 SDK client which includes all the latest API methods.
 *
 * @param projectId The project ID
 * @param opencodePort Optional port number for dev mode (required when not in Docker)
 */
export function getOpencodeClient(
	projectId: string,
	opencodePort?: number,
): OpencodeClient {
	// Include port in cache key to handle potential port changes
	const cacheKey = opencodePort ? `${projectId}:${opencodePort}` : projectId;

	if (!clientCache.has(cacheKey)) {
		const baseUrl = getOpencodeBaseUrl(projectId, opencodePort);
		logger.debug(
			{ projectId, baseUrl, isDocker: isRunningInDocker() },
			"Creating opencode client",
		);

		clientCache.set(
			cacheKey,
			createClient({
				baseUrl,
			}),
		);
	}

	const client = clientCache.get(cacheKey);
	if (!client) {
		throw new Error(`Client for key ${cacheKey} not found in cache`);
	}
	return client;
}

/**
 * Legacy function name - use getOpencodeClient instead.
 * @deprecated Use getOpencodeClient() for cached clients
 */
export function createOpencodeClient(
	projectId: string,
	opencodePort?: number,
): OpencodeClient {
	return getOpencodeClient(projectId, opencodePort);
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
 *
 * @param projectId The project ID
 * @param opencodePort Optional port number for dev mode (required when not in Docker)
 */
export async function isOpencodeHealthy(
	projectId: string,
	opencodePort?: number,
): Promise<boolean> {
	const checkSdkHealth = (): Effect.Effect<boolean, Error> =>
		Effect.tryPromise({
			try: async () => {
				const client = createOpencodeClient(projectId, opencodePort);
				const response = await client.global.health();
				return response.response.ok;
			},
			catch: (error) => error as Error,
		});

	const checkDirectFetch = (): Effect.Effect<boolean, Error> =>
		Effect.tryPromise({
			try: async () => {
				const baseUrl = getOpencodeBaseUrl(projectId, opencodePort);
				const response = await fetch(`${baseUrl}/doc`, {
					method: "GET",
					signal: AbortSignal.timeout(2000),
				});
				return response.status === 200;
			},
			catch: (error) => error as Error,
		});

	const checkHealthEffect = checkSdkHealth().pipe(
		Effect.orElse(() => checkDirectFetch()),
		Effect.orElse(() => Effect.succeed(false)),
	);

	return Effect.runPromise(checkHealthEffect);
}

export type { OpencodeClient };
