import { logger } from "@/server/logger";
import { createOpenRouterClient } from "./client";

/**
 * Validate an OpenRouter API key by attempting to list models.
 * @param apiKey OpenRouter API key to validate
 * @returns Object with valid boolean and optional error message
 */
export async function validateOpenRouterApiKey(
	apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
	try {
		const client = createOpenRouterClient(apiKey);
		await client.models.list({});

		return { valid: true };
	} catch (error) {
		logger.debug({ error }, "Failed to validate OpenRouter API key");
		// Pass through SDK error (e.g., 401 Unauthorized, network errors, etc.)
		throw error;
	}
}
