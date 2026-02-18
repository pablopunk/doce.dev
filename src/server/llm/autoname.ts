import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { Effect } from "effect";
import { LlmError, LlmTimeoutError } from "@/server/effect/errors";
import { logger } from "@/server/logger";
import { getApiKey } from "@/server/opencode/authFile";
import { generateUniqueSlug } from "@/server/projects/slug";

/**
 * List of models to try for auto-naming, in order of preference.
 * Prioritizes fast, cheap models.
 */
const MODEL_PREFERENCES = [
	"google/gemini-2.0-flash-exp",
	"openai/gpt-4o-mini",
	"anthropic/claude-3-haiku-20240307",
] as const;

const TIMEOUT_MS = 5000;

let openRouterProvider: ReturnType<typeof createOpenRouter> | null = null;

/**
 * Get or create an OpenRouter provider instance.
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
 * Create an Effect that attempts to generate a name using a specific model.
 */
function generateNameWithModel(
	model: string,
	prompt: string,
): Effect.Effect<string, LlmError | LlmTimeoutError> {
	return Effect.gen(function* () {
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

		const { text } = yield* generateEffect.pipe(
			Effect.timeout(TIMEOUT_MS),
			Effect.catchTag(
				"TimeoutException",
				() =>
					new LlmTimeoutError({
						model,
						timeoutMs: TIMEOUT_MS,
					}),
			),
		);

		return text;
	});
}

/**
 * Normalize a raw name into a valid slug format.
 */
function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 50);
}

/**
 * Build the auto-naming prompt from user input.
 */
function buildNamingPrompt(prompt: string): string {
	return `Generate a short, descriptive project name (2-4 words) for this project description: "${prompt}"

Requirements:
- Use only lowercase letters, numbers, and hyphens
- No spaces or special characters
- Maximum 50 characters
- Must be suitable as a URL slug
- Be creative and descriptive

Return only the project name, nothing else.`;
}

/**
 * Create the chained Effect that tries all models in sequence.
 */
function createModelRetryEffect(
	prompt: string,
): Effect.Effect<string, LlmError | LlmTimeoutError> {
	const aiPrompt = buildNamingPrompt(prompt);

	const [firstModel, ...restModels] = MODEL_PREFERENCES;

	let chain = generateNameWithModel(firstModel, aiPrompt);

	for (const model of restModels) {
		chain = chain.pipe(
			Effect.orElse(() => generateNameWithModel(model, aiPrompt)),
		);
	}

	return chain;
}

/**
 * Generate a project name using AI.
 *
 * Attempts to call multiple fast/cheap models in order of preference.
 * Falls back to slug-based naming if no models succeed.
 *
 * @param prompt User's project description
 * @returns Project name suitable as a URL slug
 */
export async function generateProjectName(prompt: string): Promise<string> {
	const program = Effect.gen(function* () {
		const rawName = yield* createModelRetryEffect(prompt);

		const name = rawName.trim();
		const normalized = normalizeName(name);

		if (!normalized) {
			return yield* Effect.fail(new Error("Empty normalized name"));
		}

		return normalized;
	}).pipe(
		// Log errors but don't fail - use fallback instead
		Effect.tapError((error) =>
			Effect.sync(() => {
				logger.warn(
					{
						error:
							error instanceof LlmError
								? error.message
								: error instanceof LlmTimeoutError
									? `Timeout after ${error.timeoutMs}ms`
									: String(error),
					},
					"Auto-naming failed, using fallback",
				);
			}),
		),
		// Fallback to slug generation if all models fail
		Effect.orElse(() =>
			Effect.tryPromise({
				try: () => generateUniqueSlug(prompt),
				catch: () => prompt, // Last resort fallback
			}),
		),
	);

	return Effect.runPromise(program);
}
