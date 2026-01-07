import { logger } from "@/server/logger";
import { generateUniqueSlug } from "@/server/projects/slug";
import { generateTextWithFallback } from "./client";

/**
 * List of models to try for auto-naming, in order of preference.
 * Prioritizes fast, cheap models.
 */
const MODEL_PREFERENCES = [
	"google/gemini-2.0-flash-exp", // Very fast, cheap
	"openai/gpt-4o-mini", // Fast, cheap
	"anthropic/claude-3-haiku-20240307", // Fast, cheap
];

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
	try {
		const aiPrompt = `Generate a short, descriptive project name (2-4 words) for this project description: "${prompt}"

Requirements:
- Use only lowercase letters, numbers, and hyphens
- No spaces or special characters
- Maximum 50 characters
- Must be suitable as a URL slug
- Be creative and descriptive

Return only the project name, nothing else.`;

		// Try each model in preference order
		for (const model of MODEL_PREFERENCES) {
			try {
				const rawName = await generateTextWithFallback(model, aiPrompt, {
					timeoutMs: 5000, // 5 second timeout per model
				});

				const name = rawName.trim();

				// Validate and clean the name
				const normalized = name
					.toLowerCase()
					.replace(/[^a-z0-9\s-]/g, "") // Remove special chars
					.replace(/\s+/g, "-") // Replace spaces with hyphens
					.replace(/-+/g, "-") // Collapse multiple hyphens
					.replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
					.slice(0, 50); // Limit length

				if (normalized) {
					return generateUniqueSlug(normalized);
				}
			} catch {
				// Continue to next model
			}
		}

		// All models failed, use fallback
		return generateUniqueSlug(prompt);
	} catch (error) {
		logger.warn(
			{
				error: error instanceof Error ? error.message : String(error),
			},
			"Auto-naming failed completely, using fallback",
		);
		return generateUniqueSlug(prompt);
	}
}
