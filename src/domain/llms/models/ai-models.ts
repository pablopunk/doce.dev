/**
 * Centralized AI Model Configuration
 *
 * This file contains all available AI models and related constants.
 * Import from here to ensure consistency across the application.
 */

export interface AIModel {
	id: string;
	name: string;
	provider: string;
	description: string;
}

/**
 * All available AI models
 * All models are accessed through OpenRouter, which supports 400+ models from all providers
 */
export const AVAILABLE_AI_MODELS: AIModel[] = [
	{
		id: "openai/gpt-5.1-codex",
		name: "GPT-5.1 Codex",
		provider: "OpenAI",
		description:
			"Specialized for software engineering. Agentic coding with adjustable reasoning.",
	},
	{
		id: "anthropic/claude-sonnet-4.5",
		name: "Claude Sonnet 4.5",
		provider: "Anthropic",
		description:
			"Most advanced for coding and autonomous agents. Top SWE-bench scores.",
	},
	{
		id: "google/gemini-2.5-pro",
		name: "Gemini 2.5 Pro",
		provider: "Google",
		description: "Advanced reasoning and coding. Top LMArena performance.",
	},

	{
		id: "x-ai/grok-code-fast-1",
		name: "Grok Code Fast",
		provider: "xAI",
		description: "Fast agentic coding. Shows reasoning traces in responses.",
	},
];

/**
 * Default model used when none is configured
 */
export const DEFAULT_AI_MODEL = AVAILABLE_AI_MODELS[0].id;

/**
 * Get model info by ID
 */
export function getModelById(id: string): AIModel | undefined {
	return AVAILABLE_AI_MODELS.find((model) => model.id === id);
}

/**
 * Check if a model ID is valid
 */
export function isValidModel(id: string): boolean {
	return AVAILABLE_AI_MODELS.some((model) => model.id === id);
}
