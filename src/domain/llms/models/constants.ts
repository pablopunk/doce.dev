/**
 * LLM domain constants
 */

export const AI_PROVIDERS = {
	OPENROUTER: "openrouter",
} as const;

export type AIProvider = (typeof AI_PROVIDERS)[keyof typeof AI_PROVIDERS];
