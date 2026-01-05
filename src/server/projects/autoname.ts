import { eq } from "drizzle-orm";
import { logger } from "@/server/logger";
import { generateUniqueSlug } from "./slug";
import { getAutonameModel } from "@/server/opencode/models";
import { listConnectedProviderIds } from "@/server/opencode/authFile";
import { createOpenRouterClient } from "@/server/openrouter/client";
import { db } from "@/server/db/client";
import { userSettings } from "@/server/db/schema";

/**
 * Generate a project name using AI.
 *
 * Attempts to call an LLM with the user's project prompt to generate
 * a better, more descriptive project name. Falls back to slug-based
 * naming if no models are available or if the LLM call fails.
 *
 * Flow:
 * 1. Get list of connected provider IDs from auth config
 * 2. Select the fastest/cheapest model using getAutonameModel()
 * 3. Call OpenRouter API with a naming prompt
 * 4. Extract the generated name and convert to slug
 * 5. On any error, fall back to generateUniqueSlug(prompt)
 */
export async function generateProjectNameWithLLM(
	prompt: string,
	ownerUserId: string,
): Promise<string> {
	try {
		// Get connected providers
		const connectedProviderIds = await listConnectedProviderIds();
		logger.debug(
			{ providerCount: connectedProviderIds.length },
			"Listed connected providers for auto-naming",
		);

		// If no providers configured, use fallback
		if (connectedProviderIds.length === 0) {
			logger.debug(
				"No connected providers for auto-naming, using fallback slug generation",
			);
			return generateUniqueSlug(prompt);
		}

		// Get the fastest/cheapest model from available providers
		const modelId = await getAutonameModel(connectedProviderIds);

		if (!modelId) {
			logger.debug(
				{ connectedProviderIds },
				"No available models for auto-naming, using fallback",
			);
			return generateUniqueSlug(prompt);
		}

		logger.debug({ modelId }, "Selected model for auto-naming");

		// Get OpenRouter API key from user settings
		const userSettings_ = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, ownerUserId))
			.limit(1);

		const apiKey = userSettings_[0]?.openrouterApiKey;
		if (!apiKey) {
			logger.debug(
				{ ownerUserId },
				"User has no OpenRouter API key configured, using fallback slug generation",
			);
			return generateUniqueSlug(prompt);
		}

		// Create OpenRouter client
		const client = createOpenRouterClient(apiKey);

		// Call LLM to generate project name
		try {
			const response = await client.chat.send({
				model: modelId,
				messages: [
					{
						role: "user",
						content: `Generate a short, descriptive project name (2-4 words) for this project description: "${prompt}"

Requirements:
- Use only lowercase letters, numbers, and hyphens
- No spaces or special characters
- Maximum 50 characters
- Must be suitable as a URL slug
- Be creative and descriptive

Return only the project name, nothing else.`,
					},
				],
				maxCompletionTokens: 50,
			});

			// Extract the generated name
			const content = response.choices[0]?.message?.content;
			let generatedName: string | undefined;

			// Handle both string and array content types
			if (typeof content === "string") {
				generatedName = content.trim();
			}

			if (!generatedName) {
				logger.warn("LLM returned empty response for project name");
				return generateUniqueSlug(prompt);
			}

			logger.info(
				{ generatedName, modelId, ownerUserId },
				"Generated project name with LLM",
			);

			// Validate it's a reasonable slug before using it
			const normalized = generatedName
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, "")
				.replace(/\s+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-+|-+$/g, "")
				.slice(0, 50);

			if (!normalized) {
				logger.warn({ generatedName }, "Generated name not valid as slug");
				return generateUniqueSlug(prompt);
			}

			// Make sure the slug is unique
			return generateUniqueSlug(normalized);
		} catch (llmError) {
			logger.warn(
				{
					modelId,
					error:
						llmError instanceof Error ? llmError.message : String(llmError),
				},
				"LLM call for auto-naming failed, using fallback",
			);
			return generateUniqueSlug(prompt);
		}
	} catch (error) {
		logger.warn(
			{
				error: error instanceof Error ? error.message : String(error),
			},
			"Auto-naming failed, using fallback slug generation",
		);
		return generateUniqueSlug(prompt);
	}
}
