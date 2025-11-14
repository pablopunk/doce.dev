import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { LLMConfig } from "@/domain/llms/models/llm-config";

export const server = {
	/**
	 * Get API keys status for all providers
	 */
	getApiKeys: defineAction({
		handler: async () => {
			const keys = LLMConfig.getApiKeys();
			return { keys };
		},
	}),

	/**
	 * Set API key for a provider
	 */
	setApiKey: defineAction({
		input: z.object({
			provider: z.enum(["openrouter"]),
			apiKey: z.string(),
		}),
		handler: async ({ provider, apiKey }) => {
			try {
				LLMConfig.setApiKey(provider, apiKey);
				return { success: true };
			} catch (error) {
				console.error("Failed to save API key:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to save API key",
				});
			}
		},
	}),

	/**
	 * Get current model and available models
	 */
	getModel: defineAction({
		handler: async () => {
			const currentModel = LLMConfig.getCurrentModel();
			const availableModels = LLMConfig.getAvailableModels();

			return {
				currentModel,
				availableModels,
			};
		},
	}),

	/**
	 * Set the default AI model
	 */
	setModel: defineAction({
		input: z.object({
			model: z.string(),
		}),
		handler: async ({ model }) => {
			try {
				LLMConfig.setModel(model);
				return { success: true, model };
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Failed to set model";
				console.error("Failed to set model:", error);

				throw new ActionError({
					code: "BAD_REQUEST",
					message,
				});
			}
		},
	}),
};
