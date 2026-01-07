/**
 * Global model configuration for all providers.
 * These models are whitelisted and appear in the UI across all providers.
 * Format: "vendor/model-id" (provider prefix is added by ModelSelector)
 */

export const CURATED_MODELS = [
	"openai/gpt-5.2",
	"openai/gpt-4.1-mini",
	"anthropic/claude-haiku-4-5",
	"anthropic/claude-haiku-4.5",
	"google/gemini-3-flash",
] as const;

/**
 * Default model for new users (set in user settings)
 */
export const DEFAULT_MODEL: (typeof CURATED_MODELS)[number] =
	"anthropic/claude-haiku-4-5";

/**
 * Fast/cheap model for auto-naming and other quick operations
 */
export const FAST_MODEL: (typeof CURATED_MODELS)[number] =
	"google/gemini-3-flash";

/**
 * Fallback model when no other model is available.
 * Used when project has no model specified, user has no default, etc.
 * Note: This includes the provider prefix for safe fallback.
 */
export const FALLBACK_MODEL = "openrouter/google/gemini-2.5-flash";
