/**
 * LLM Configuration Model
 * Handles AI provider configuration, API keys, and model selection
 */

import * as db from "@/lib/db";
import {
	AVAILABLE_AI_MODELS,
	DEFAULT_AI_MODEL,
	isValidModel,
	type AIModel,
} from "@/domain/llms/models/ai-models";

export type AIProvider = "openrouter";

export interface AIConfig {
	provider: AIProvider;
	apiKey: string | null;
	currentModel: string;
}

/**
 * LLMConfig Model
 * Static methods for managing LLM configuration
 */
export class LLMConfig {
	/**
	 * Get API keys status for all providers
	 */
	static getApiKeys(): Record<AIProvider, boolean> {
		const providers: AIProvider[] = ["openrouter"];
		const keys: Record<string, boolean> = {};

		for (const provider of providers) {
			const configItem = db.config.get(`${provider}_api_key`);
			keys[provider] = Boolean(configItem?.value);
		}

		return keys as Record<AIProvider, boolean>;
	}

	/**
	 * Set API key for a provider
	 */
	static setApiKey(provider: AIProvider, apiKey: string): void {
		const trimmedKey = apiKey?.trim() || "";
		db.config.set(`${provider}_api_key`, trimmedKey);
	}

	/**
	 * Get the current AI model configuration
	 */
	static getCurrentModel(): string {
		const configItem = db.config.get("default_ai_model");
		return configItem?.value || DEFAULT_AI_MODEL;
	}

	/**
	 * Get all available AI models
	 */
	static getAvailableModels(): AIModel[] {
		return AVAILABLE_AI_MODELS;
	}

	/**
	 * Set the default AI model
	 */
	static setModel(modelId: string): void {
		if (!isValidModel(modelId)) {
			throw new Error(`Invalid model ID: ${modelId}`);
		}
		db.config.set("default_ai_model", modelId);
	}

	/**
	 * Get current AI provider
	 */
	static getCurrentProvider(): AIProvider | null {
		const configItem = db.config.get("ai_provider");
		return (configItem?.value as AIProvider) || null;
	}

	/**
	 * Set current AI provider
	 */
	static setProvider(provider: AIProvider): void {
		db.config.set("ai_provider", provider);
	}

	/**
	 * Get complete AI configuration
	 */
	static getConfig(): AIConfig {
		const provider = LLMConfig.getCurrentProvider() || "openrouter";
		const apiKeyConfig = db.config.get(`${provider}_api_key`);
		const apiKey = apiKeyConfig?.value || null;
		const currentModel = LLMConfig.getCurrentModel();

		return {
			provider,
			apiKey,
			currentModel,
		};
	}

	/**
	 * Check if AI is properly configured
	 */
	static isConfigured(): boolean {
		const config = LLMConfig.getConfig();
		return Boolean(
			config.apiKey ||
				process.env.OPENAI_API_KEY ||
				process.env.ANTHROPIC_API_KEY ||
				process.env.OPENROUTER_API_KEY,
		);
	}
}
