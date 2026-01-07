import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { logger } from "@/server/logger";
import { getApiKey } from "@/server/opencode/authFile";

// Cache the provider instance to avoid recreating it
let openRouterProvider: ReturnType<typeof createOpenRouter> | null = null;

/**
 * Get or create an OpenRouter provider instance.
 * Uses cached instance to avoid overhead.
 */
async function getOpenRouterProvider(): Promise<
	ReturnType<typeof createOpenRouter>
> {
	if (!openRouterProvider) {
		const apiKey = await getApiKey("openrouter");
		if (!apiKey) {
			throw new Error("No OpenRouter API key configured");
		}
		openRouterProvider = createOpenRouter({
			apiKey,
		});
	}
	return openRouterProvider;
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
	try {
		const provider = await getOpenRouterProvider();
		const generateOptions: any = {
			model: provider(model),
			prompt,
		};

		if (options.timeoutMs) {
			generateOptions.abortSignal = AbortSignal.timeout(options.timeoutMs);
		}

		const { text } = await generateText(generateOptions);

		return text;
	} catch (error) {
		logger.warn(
			{
				model,
				error: error instanceof Error ? error.message : String(error),
			},
			"Text generation failed",
		);
		throw error;
	}
}
