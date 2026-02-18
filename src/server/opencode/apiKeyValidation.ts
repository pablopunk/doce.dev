import { Effect } from "effect";
import { ApiKeyValidationError } from "@/server/effect/errors";
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
	const effect = Effect.gen(function* () {
		const validators: Record<
			string,
			(apiKey: string) => Effect.Effect<ValidationResult, ApiKeyValidationError>
		> = {
			openrouter: validateOpenRouterKeyEffect,
			anthropic: validateAnthropicKeyEffect,
			openai: validateOpenAIKeyEffect,
			zai: validateOpenAICompatibleKeyEffect("https://api.z.ai/api/paas/v4"),
			zenmux: validateOpenAICompatibleKeyEffect(
				"https://zenmux.ai/api/anthropic/v1",
			),
			gemini: validateOpenAICompatibleKeyEffect(
				"https://generativelanguage.googleapis.com/v1beta",
			),
			cohere: validateOpenAICompatibleKeyEffect("https://api.cohere.ai/v1"),
			mistral: validateOpenAICompatibleKeyEffect("https://api.mistral.ai/v1"),
			groq: validateOpenAICompatibleKeyEffect("https://api.groq.com/openai/v1"),
		};

		const validatorEffect =
			validators[providerId] ??
			validateOpenAICompatibleKeyEffect("https://api.openai.com/v1");

		const result = yield* Effect.either(validatorEffect(apiKey));

		if (result._tag === "Left") {
			logger.error(
				{ provider: providerId, error: result.left },
				"API key validation failed",
			);
			return {
				valid: false,
				error: result.left.message,
			};
		}

		return result.right;
	});

	return Effect.runPromise(effect);
}

function validateOpenAICompatibleKeyEffect(baseUrl: string) {
	return (
		apiKey: string,
	): Effect.Effect<ValidationResult, ApiKeyValidationError> =>
		Effect.gen(function* () {
			if (!apiKey.startsWith("sk-") && !apiKey.startsWith("api-")) {
				return {
					valid: false,
					error:
						"Invalid API key format. Keys typically start with 'sk-' or 'api-'.",
				};
			}

			const response = yield* Effect.tryPromise({
				try: () =>
					fetch(`${baseUrl}/models`, {
						method: "GET",
						headers: {
							Authorization: `Bearer ${apiKey}`,
						},
						signal: AbortSignal.timeout(10_000),
					}),
				catch: (error) => {
					const err = error as Error;
					if (error instanceof DOMException) {
						return new ApiKeyValidationError({
							provider: baseUrl,
							message:
								"Failed to connect to provider. Please check your internet connection.",
						});
					}
					if (err.name === "TimeoutError") {
						return new ApiKeyValidationError({
							provider: baseUrl,
							message: "Validation timed out. Please try again.",
						});
					}
					logger.error({ error }, "API key validation request failed");
					return new ApiKeyValidationError({
						provider: baseUrl,
						message: "Failed to connect to provider. Please try again.",
					});
				},
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
		});
}

function validateOpenRouterKeyEffect(
	apiKey: string,
): Effect.Effect<ValidationResult, ApiKeyValidationError> {
	return Effect.gen(function* () {
		const response = yield* Effect.tryPromise({
			try: () =>
				fetch("https://openrouter.ai/api/v1/key", {
					method: "GET",
					headers: {
						Authorization: `Bearer ${apiKey}`,
					},
					signal: AbortSignal.timeout(10_000),
				}),
			catch: (error) => {
				const err = error as Error;
				if (error instanceof DOMException) {
					return new ApiKeyValidationError({
						provider: "openrouter",
						message:
							"Failed to connect to OpenRouter. Please check your internet connection.",
					});
				}
				if (err.name === "TimeoutError") {
					return new ApiKeyValidationError({
						provider: "openrouter",
						message: "Validation timed out. Please try again.",
					});
				}
				logger.error({ error }, "OpenRouter validation request failed");
				return new ApiKeyValidationError({
					provider: "openrouter",
					message: "Failed to connect to OpenRouter. Please try again.",
				});
			},
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
	});
}

/**
 * Validate OpenRouter API key by calling their /key endpoint
 */
export async function validateOpenRouterKey(
	apiKey: string,
): Promise<ValidationResult> {
	return Effect.runPromise(validateOpenRouterKeyEffect(apiKey));
}

function validateAnthropicKeyEffect(
	apiKey: string,
): Effect.Effect<ValidationResult, ApiKeyValidationError> {
	return Effect.gen(function* () {
		if (!apiKey.startsWith("sk-ant-")) {
			return {
				valid: false,
				error:
					"Invalid Anthropic API key format. Keys should start with 'sk-ant-'.",
			};
		}

		const response = yield* Effect.tryPromise({
			try: () =>
				fetch("https://api.anthropic.com/v1/models", {
					method: "GET",
					headers: {
						"x-api-key": apiKey,
						"anthropic-version": "2023-06-01",
					},
					signal: AbortSignal.timeout(10_000),
				}),
			catch: (error) => {
				const err = error as Error;
				if (error instanceof DOMException) {
					return new ApiKeyValidationError({
						provider: "anthropic",
						message:
							"Failed to connect to Anthropic. Please check your internet connection.",
					});
				}
				if (err.name === "TimeoutError") {
					return new ApiKeyValidationError({
						provider: "anthropic",
						message: "Validation timed out. Please try again.",
					});
				}
				logger.error({ error }, "Anthropic validation request failed");
				return new ApiKeyValidationError({
					provider: "anthropic",
					message: "Failed to connect to Anthropic. Please try again.",
				});
			},
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
			logger.warn(
				"Anthropic rate limited during key validation, assuming valid",
			);
			return { valid: true };
		}

		return {
			valid: false,
			error: `Unable to verify API key (${response.status}). Please try again.`,
		};
	});
}

/**
 * Validate Anthropic API key by calling their /models endpoint
 */
export async function validateAnthropicKey(
	apiKey: string,
): Promise<ValidationResult> {
	return Effect.runPromise(validateAnthropicKeyEffect(apiKey));
}

function validateOpenAIKeyEffect(
	apiKey: string,
): Effect.Effect<ValidationResult, ApiKeyValidationError> {
	return Effect.gen(function* () {
		if (!apiKey.startsWith("sk-")) {
			return {
				valid: false,
				error: "Invalid OpenAI API key format. Keys should start with 'sk-'.",
			};
		}

		const response = yield* Effect.tryPromise({
			try: () =>
				fetch("https://api.openai.com/v1/models", {
					method: "GET",
					headers: {
						Authorization: `Bearer ${apiKey}`,
					},
					signal: AbortSignal.timeout(10_000),
				}),
			catch: (error) => {
				const err = error as Error;
				if (error instanceof DOMException) {
					return new ApiKeyValidationError({
						provider: "openai",
						message:
							"Failed to connect to OpenAI. Please check your internet connection.",
					});
				}
				if (err.name === "TimeoutError") {
					return new ApiKeyValidationError({
						provider: "openai",
						message: "Validation timed out. Please try again.",
					});
				}
				logger.error({ error }, "OpenAI validation request failed");
				return new ApiKeyValidationError({
					provider: "openai",
					message: "Failed to connect to OpenAI. Please try again.",
				});
			},
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
			logger.warn("OpenAI rate limited during key validation, assuming valid");
			return { valid: true };
		}

		return {
			valid: false,
			error: `Unable to verify API key (${response.status}). Please try again.`,
		};
	});
}

/**
 * Validate OpenAI API key by calling their /models endpoint
 */
export async function validateOpenAIKey(
	apiKey: string,
): Promise<ValidationResult> {
	return Effect.runPromise(validateOpenAIKeyEffect(apiKey));
}
