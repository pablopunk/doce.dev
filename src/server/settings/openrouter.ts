// Re-export model list and types from the openrouter module
export {
	AVAILABLE_MODELS,
	DEFAULT_MODEL,
	FAST_MODEL,
	type ModelId,
} from "@/server/openrouter/models";
// Re-export validation from the openrouter module
export { validateOpenRouterApiKey } from "@/server/openrouter/validation";

import { logger } from "@/server/logger";
import { createOpenRouterClient } from "@/server/openrouter/client";
import { FAST_MODEL } from "@/server/openrouter/models";

/**
 * Generate a creative project name using AI.
 * Uses fallback if generation fails.
 * @param apiKey OpenRouter API key
 * @param prompt User's project description
 * @returns Generated project name
 */
export async function generateProjectName(
	apiKey: string,
	prompt: string,
): Promise<string> {
	try {
		const client = createOpenRouterClient(apiKey);

		const response = await client.chat.send({
			model: FAST_MODEL,
			messages: [
				{
					role: "system",
					content:
						"You are a helpful assistant that generates short, creative project names that are 'repo-name-friendly'. Generate a single project name (3-5 words) based on the user's description. Only output the name, nothing else. Use lowercase letters and hyphens only.",
				},
				{
					role: "user",
					content: `Generate a short project name for: ${prompt}`,
				},
			],
			maxCompletionTokens: 50,
		});

		const content = response.choices[0]?.message?.content;
		let name: string | undefined;

		// Handle both string and array content types
		if (typeof content === "string") {
			name = content.trim();
		}

		if (name) {
			// Clean up the name: lowercase, replace spaces with hyphens, remove special chars
			return name
				.toLowerCase()
				.replace(/\s+/g, "-")
				.replace(/[^a-z0-9-]/g, "")
				.slice(0, 50);
		}

		throw new Error("No name generated");
	} catch (error) {
		logger.warn({ error }, "Failed to generate project name, using fallback");
		// Fallback: use first few words of the prompt
		return prompt
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, "")
			.split(/\s+/)
			.slice(0, 3)
			.join("-")
			.slice(0, 50);
	}
}
