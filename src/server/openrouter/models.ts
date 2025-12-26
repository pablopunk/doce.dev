// Curated list of models for the UI
export const AVAILABLE_MODELS = [
	{
		id: "openai/gpt-5.2",
		name: "GPT-5.2",
		provider: "OpenAI",
		tier: "top",
		supportsImages: true,
	},
	{
		id: "openai/gpt-4.1-mini",
		name: "GPT-4.1 Mini",
		provider: "OpenAI",
		tier: "fast",
		supportsImages: true,
	},
	{
		id: "anthropic/claude-opus-4.5",
		name: "Claude Opus 4.5",
		provider: "Anthropic",
		tier: "top",
		supportsImages: true,
	},
	{
		id: "anthropic/claude-haiku-4.5",
		name: "Claude Haiku 4.5",
		provider: "Anthropic",
		tier: "fast",
		supportsImages: true,
	},
	{
		id: "google/gemini-3-pro-preview",
		name: "Gemini 3 Pro",
		provider: "Google",
		tier: "top",
		supportsImages: true,
	},
	{
		id: "google/gemini-2.5-flash",
		name: "Gemini 2.5 Flash",
		provider: "Google",
		tier: "fast",
		supportsImages: true,
	},
	{
		id: "z-ai/glm-4.7",
		name: "GLM-4.7",
		provider: "Z.ai",
		tier: "top",
		supportsImages: false,
	},
] as const;

export type ModelId = (typeof AVAILABLE_MODELS)[number]["id"];

export const DEFAULT_MODEL: ModelId = "anthropic/claude-haiku-4.5";
export const FAST_MODEL: ModelId = "google/gemini-2.5-flash";
