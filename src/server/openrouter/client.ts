import { OpenRouter } from "@openrouter/sdk";

/**
 * Create an authenticated OpenRouter client instance.
 * @param apiKey OpenRouter API key
 * @returns Authenticated OpenRouter client
 */
export function createOpenRouterClient(apiKey: string): OpenRouter {
	return new OpenRouter({
		apiKey,
	});
}
