import { logger } from "@/server/logger";

/**
 * Result of API key validation
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
}

/**
 * Validate API key for a provider
 */
export async function validateApiKey(
	providerId: string,
	apiKey: string,
): Promise<ValidationResult> {
	const validators: Record<
		string,
		(apiKey: string) => Promise<ValidationResult>
	> = {
		openrouter: validateOpenRouterKey,
		anthropic: validateAnthropicKey,
		openai: validateOpenAIKey,
		zai: validateOpenAICompatibleKey("https://api.z.ai/api/paas/v4"),
		zenmux: validateOpenAICompatibleKey("https://zenmux.ai/api/anthropic/v1"),
		gemini: validateOpenAICompatibleKey(
			"https://generativelanguage.googleapis.com/v1beta",
		),
		cohere: validateOpenAICompatibleKey("https://api.cohere.ai/v1"),
		mistral: validateOpenAICompatibleKey("https://api.mistral.ai/v1"),
		groq: validateOpenAICompatibleKey("https://api.groq.com/openai/v1"),
	};

	const validator =
		validators[providerId] ||
		(() => validateOpenAICompatibleKey("https://api.openai.com/v1")(apiKey));

	try {
		const result = await validator(apiKey);
		return result;
	} catch (error) {
		const err = error as Error;
		logger.error({ provider: providerId, error }, "API key validation failed");
		return {
			valid: false,
			error: err instanceof Error ? err.message : String(error),
		};
	}
}

/**
 * Generic OpenAI-compatible API validator
 */
function validateOpenAICompatibleKey(baseUrl: string) {
	return async (apiKey: string): Promise<ValidationResult> => {
		if (!apiKey.startsWith("sk-") && !apiKey.startsWith("api-")) {
			return {
				valid: false,
				error:
					"Invalid API key format. Keys typically start with 'sk-' or 'api-'.",
			};
		}

		try {
			const response = await fetch(`${baseUrl}/models`, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
				signal: AbortSignal.timeout(10_000),
			});

			if (response.ok) {
				return { valid: true };
			}

			if (response.status === 401) {
				return {
					valid: false,
					error: "Invalid API key. Please check your key and try again.",
				};
			}

			if (response.status === 429) {
				logger.warn("Rate limited during key validation, assuming valid");
				return { valid: true };
			}

			return {
				valid: false,
				error: `Unable to verify API key (${response.status}). Please try again.`,
			};
		} catch (error) {
			const err = error as Error;
			if (error instanceof DOMException) {
				throw new Error(
					"Failed to connect to provider. Please check your internet connection.",
				);
			}
			if (err.name === "TimeoutError") {
				return {
					valid: false,
					error: "Validation timed out. Please try again.",
				};
			}
			logger.error({ error }, "API key validation request failed");
			throw new Error("Failed to connect to provider. Please try again.");
		}
	};
}

/**
 * Validate OpenRouter API key by calling their /key endpoint
 */
export async function validateOpenRouterKey(
	apiKey: string,
): Promise<ValidationResult> {
	try {
		const response = await fetch("https://openrouter.ai/api/v1/key", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
			signal: AbortSignal.timeout(10_000),
		});

		if (response.ok) {
			return { valid: true };
		}

		if (response.status === 401) {
			return {
				valid: false,
				error: "Invalid API key. Please check your key and try again.",
			};
		}

		return {
			valid: false,
			error: `Unable to verify API key (${response.status}). Please try again.`,
		};
	} catch (error) {
		const err = error as Error;
		if (error instanceof DOMException) {
			throw new Error(
				"Failed to connect to OpenRouter. Please check your internet connection.",
			);
		}
		if (err.name === "TimeoutError") {
			return {
				valid: false,
				error: "Validation timed out. Please try again.",
			};
		}
		logger.error({ error }, "OpenRouter validation request failed");
		throw new Error("Failed to connect to OpenRouter. Please try again.");
	}
}

/**
 * Validate Anthropic API key by calling their /models endpoint
 */
export async function validateAnthropicKey(
	apiKey: string,
): Promise<ValidationResult> {
	// Basic format check
	if (!apiKey.startsWith("sk-ant-")) {
		return {
			valid: false,
			error:
				"Invalid Anthropic API key format. Keys should start with 'sk-ant-'.",
		};
	}

	try {
		const response = await fetch("https://api.anthropic.com/v1/models", {
			method: "GET",
			headers: {
				"x-api-key": apiKey,
				"anthropic-version": "2023-06-01",
			},
			signal: AbortSignal.timeout(10_000),
		});

		if (response.ok) {
			return { valid: true };
		}

		if (response.status === 401) {
			return {
				valid: false,
				error: "Invalid API key. Please check your key and try again.",
			};
		}

		// Rate limited (429) during validation, assume key is valid
		if (response.status === 429) {
			logger.warn(
				"Anthropic rate limited during key validation, assuming valid",
			);
			return { valid: true };
		}

		return {
			valid: false,
			error: `Unable to verify API key (${response.status}). Please try again.`,
		};
	} catch (error) {
		const err = error as Error;
		if (error instanceof DOMException) {
			throw new Error(
				"Failed to connect to Anthropic. Please check your internet connection.",
			);
		}
		if (err.name === "TimeoutError") {
			return {
				valid: false,
				error: "Validation timed out. Please try again.",
			};
		}
		logger.error({ error }, "Anthropic validation request failed");
		throw new Error("Failed to connect to Anthropic. Please try again.");
	}
}

/**
 * Validate OpenAI API key by calling their /models endpoint
 */
export async function validateOpenAIKey(
	apiKey: string,
): Promise<ValidationResult> {
	// Basic format check
	if (!apiKey.startsWith("sk-")) {
		return {
			valid: false,
			error: "Invalid OpenAI API key format. Keys should start with 'sk-'.",
		};
	}

	try {
		const response = await fetch("https://api.openai.com/v1/models", {
			method: "GET",
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
			signal: AbortSignal.timeout(10_000),
		});

		if (response.ok) {
			return { valid: true };
		}

		if (response.status === 401) {
			return {
				valid: false,
				error: "Invalid API key. Please check your key and try again.",
			};
		}

		// Rate limited (429) during validation, assume key is valid
		if (response.status === 429) {
			logger.warn("OpenAI rate limited during key validation, assuming valid");
			return { valid: true };
		}

		return {
			valid: false,
			error: `Unable to verify API key (${response.status}). Please try again.`,
		};
	} catch (error) {
		const err = error as Error;
		if (error instanceof DOMException) {
			throw new Error(
				"Failed to connect to OpenAI. Please check your internet connection.",
			);
		}
		if (err.name === "TimeoutError") {
			return {
				valid: false,
				error: "Validation timed out. Please try again.",
			};
		}
		logger.error({ error }, "OpenAI validation request failed");
		throw new Error("Failed to connect to OpenAI. Please try again.");
	}
}
