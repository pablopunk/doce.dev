/**
 * Curated list of recommended models for the UI.
 * These are the only models shown in the model selector.
 * The system will filter these to only show models from connected providers.
 */
export const CURATED_MODELS = [
	{
		id: "openai/gpt-5.2",
		name: "GPT-5.2",
		provider: "OpenAI",
		tier: "top" as const,
		supportsImages: true,
	},
	{
		id: "openai/gpt-4.1-mini",
		name: "GPT-4.1 Mini",
		provider: "OpenAI",
		tier: "fast" as const,
		supportsImages: true,
	},
	{
		id: "anthropic/claude-haiku-4.5",
		name: "Claude Haiku 4.5",
		provider: "Anthropic",
		tier: "fast" as const,
		supportsImages: true,
	},
	{
		id: "google/gemini-3-flash-preview",
		name: "Gemini 3 Flash Preview",
		provider: "Google",
		tier: "fast" as const,
		supportsImages: true,
	},
] as const;

export const DEFAULT_CURATED_MODEL = "google/gemini-3-flash-preview";
export const FAST_CURATED_MODEL = "google/gemini-3-flash-preview";
