import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { getConfig, setConfig } from "@/lib/db";
import {
	AVAILABLE_AI_MODELS,
	DEFAULT_AI_MODEL,
	isValidModel,
} from "@/shared/config/ai-models";

export const server = {
	getApiKeys: defineAction({
		handler: async () => {
			const providers = ["openrouter"];

			const keys: Record<string, boolean> = {};
			for (const provider of providers) {
				const key = getConfig(`${provider}_api_key`);
				keys[provider] = Boolean(key);
			}

			return { keys };
		},
	}),

	setApiKey: defineAction({
		input: z.object({
			provider: z.enum(["openrouter"]),
			apiKey: z.string(),
		}),
		handler: async ({ provider, apiKey }) => {
			try {
				if (apiKey && apiKey.trim()) {
					setConfig(`${provider}_api_key`, apiKey.trim());
				} else {
					setConfig(`${provider}_api_key`, "");
				}

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

	getModel: defineAction({
		handler: async () => {
			const currentModel = getConfig("default_ai_model") || DEFAULT_AI_MODEL;
			return {
				currentModel,
				availableModels: AVAILABLE_AI_MODELS,
			};
		},
	}),

	setModel: defineAction({
		input: z.object({
			model: z.string(),
		}),
		handler: async ({ model }) => {
			// Validate model is in our list
			if (!isValidModel(model)) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Invalid model ID",
				});
			}

			try {
				setConfig("default_ai_model", model);
				return { success: true, model };
			} catch (error) {
				console.error("Failed to set model:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to set model",
				});
			}
		},
	}),
};
