import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { Effect } from "effect";
import { LlmError, LlmTimeoutError } from "@/server/effect/errors";
import { logger } from "@/server/logger";
import { getApiKey } from "@/server/opencode/authFile";

// Cache the provider instance to avoid recreating it
let openRouterProvider: ReturnType<typeof createOpenRouter> | null = null;

/**
 * Get or create an OpenRouter provider instance.
 * Uses cached instance to avoid overhead.
 */
function getOpenRouterProvider(): Effect.Effect<
	ReturnType<typeof createOpenRouter>,
	LlmError
> {
	return Effect.gen(function* () {
		if (!openRouterProvider) {
			const apiKey = yield* Effect.tryPromise({
				try: () => getApiKey("openrouter"),
				catch: (cause) =>
					new LlmError({
						model: "openrouter",
						message: "Failed to retrieve OpenRouter API key",
						cause,
					}),
			});

			if (!apiKey) {
				return yield* new LlmError({
					model: "openrouter",
					message: "No OpenRouter API key configured",
				});
			}

			openRouterProvider = createOpenRouter({
				apiKey,
			});
		}
		return openRouterProvider;
	});
}

/**
 * Generate text using AI SDK with error handling.
 * Attempts to call OpenRouter API, falls back gracefully on failure.
 */
export async function generateTextWithFallback(
	model: string,
	prompt: string,
	options: {
		timeoutMs?: number;
	} = {},
): Promise<string> {
	const program = Effect.gen(function* () {
		const provider = yield* getOpenRouterProvider();

		const generateEffect = Effect.tryPromise({
			try: () =>
				generateText({
					model: provider(model),
					prompt,
				}),
			catch: (cause) =>
				new LlmError({
					model,
					message: "Text generation failed",
					cause,
				}),
		});

		const timeoutEffect = options.timeoutMs
			? generateEffect.pipe(
					Effect.timeout(options.timeoutMs),
					Effect.catchTag(
						"TimeoutException",
						() =>
							new LlmTimeoutError({
								model,
								timeoutMs: options.timeoutMs ?? 0,
							}),
					),
				)
			: generateEffect;

		const { text } = yield* timeoutEffect;
		return text;
	}).pipe(
		Effect.tapError((error) =>
			Effect.sync(() => {
				logger.warn(
					{
						model,
						error:
							error instanceof LlmError
								? error.message
								: error instanceof LlmTimeoutError
									? `Timeout after ${error.timeoutMs}ms`
									: String(error),
					},
					"Text generation failed",
				);
			}),
		),
		Effect.catchTag("LlmError", (error) => Effect.fail(error)),
		Effect.catchTag("LlmTimeoutError", (error) => Effect.fail(error)),
	);

	return Effect.runPromise(program);
}
