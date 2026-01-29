/**
 * Global model configuration for all providers.
 * These models are whitelisted and appear in the UI across all providers.
 *
 * Model IDs are stored in the canonical format from models.dev:
 * - OpenCode provider: "model-id" (no vendor prefix, e.g., "claude-haiku-4-5")
 * - OpenRouter/Other: "vendor/model-id" (with vendor prefix, e.g., "openai/gpt-5.2")
 *
 * The UI will show the same model from whichever provider(s) are configured.
 * Provider is determined by which provider has that model in models.dev.
 */

export const CURATED_MODELS = [
	"gpt-5.2",
	"openai/gpt-5.2",
	"claude-haiku-4-5",
	"anthropic/claude-haiku-4.5",
	"gemini-3-flash",
	"google/gemini-3-flash",
	"gemini-3-flash-preview",
	"google/gemini-3-flash-preview",
	"moonshotai/kimi-k2.5",
	"kimi-k2.5",
] as const;

/**
 * Default model for new users (set in user settings)
 */
export const DEFAULT_MODEL: (typeof CURATED_MODELS)[number] =
	"claude-haiku-4-5";

/**
 * Fast/cheap model for auto-naming and other quick operations
 */
export const FAST_MODEL: (typeof CURATED_MODELS)[number] = "gemini-3-flash";

/**
 * Fallback model when no other model is available.
 * Used when project has no model specified, user has no default, etc.
 * Note: This includes the provider prefix for safe fallback.
 */
export const FALLBACK_MODEL = "openrouter/google/gemini-2.5-flash";
