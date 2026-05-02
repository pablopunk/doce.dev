import {
	createOpencodeClient as createClient,
	type OpencodeClient,
} from "@opencode-ai/sdk/v2/client";
import { Effect } from "effect";
import { checkOpencodeServerReady } from "@/server/health/checkHealthEndpoint";
import { logger } from "@/server/logger";
import { ensureGlobalOpencodeStarted, getOpencodeBaseUrl } from "./runtime";

let cachedClient: OpencodeClient | null = null;

export function createOpencodeClient(_directory?: string): OpencodeClient {
	if (!cachedClient) {
		const baseUrl = getOpencodeBaseUrl();
		logger.debug({ baseUrl }, "Creating central OpenCode client");
		cachedClient = createClient({ baseUrl });
	}
	return cachedClient;
}

export function clearOpencodeClientCache(): void {
	cachedClient = null;
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
