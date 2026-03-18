import {
	createOpencodeClient as createClient,
	type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";
import { Effect } from "effect";
import { checkOpencodeServerReady } from "@/server/health/checkHealthEndpoint";
import { logger } from "@/server/logger";
import { ensureGlobalOpencodeStarted, getOpencodeBaseUrl } from "./runtime";

const clientCache = new Map<string, OpencodeClient>();

export function getOpencodeClient(_directory?: string): OpencodeClient {
	const cacheKey = "__global__";

	if (!clientCache.has(cacheKey)) {
		const baseUrl = getOpencodeBaseUrl();
		logger.debug({ baseUrl }, "Creating central OpenCode client");

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

export function createOpencodeClient(directory?: string): OpencodeClient {
	return getOpencodeClient(directory);
}

export function clearOpencodeClientCache(directory?: string): void {
	void directory;
	clientCache.delete("__global__");
}

export async function isOpencodeHealthy(): Promise<boolean> {
	const checkSdkHealth = (): Effect.Effect<boolean, Error> =>
		Effect.tryPromise({
			try: async () => {
				await ensureGlobalOpencodeStarted();
				const client = createOpencodeClient();
				const response = await client.global.health();
				return response.response.ok;
			},
			catch: (error) => error as Error,
		});

	const checkDirectFetch = (): Effect.Effect<boolean, Error> =>
		Effect.tryPromise({
			try: async () =>
				checkOpencodeServerReady(
					getOpencodeBaseUrl().replace("http://", ""),
					2_000,
				),
			catch: (error) => error as Error,
		});

	return Effect.runPromise(
		checkSdkHealth().pipe(
			Effect.orElse(() => checkDirectFetch()),
			Effect.orElse(() => Effect.succeed(false)),
		),
	);
}

export type { OpencodeClient };
