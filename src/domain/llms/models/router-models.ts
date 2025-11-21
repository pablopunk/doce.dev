import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { LLMConfig } from "@/domain/llms/models/llm-config";

/**
 * Convenience helpers for small, internal routing models.
 * These are NOT exposed in the UI model list.
 */

export function getTemplateRoutingModel() {
	const apiKey = LLMConfig.getApiKey("openrouter");
	if (!apiKey) {
		throw new Error(
			"No OpenRouter API key configured. Configure it in /settings before creating projects.",
		);
	}

	const openrouter = createOpenRouter({ apiKey });
	// Small, cheap model for classification / routing
	return openrouter("google/gemini-2.5-flash");
}
