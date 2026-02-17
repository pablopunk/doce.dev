import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { cachedAction } from "@/server/cache/actionCache";
import { invalidatePrefix } from "@/server/cache/memory";
import { CURATED_MODELS } from "@/server/config/models";
import { logger } from "@/server/logger";
import { validateApiKey } from "@/server/opencode/apiKeyValidation";
import {
	listConnectedProviderIds,
	removeProvider,
	setApiKey,
} from "@/server/opencode/authFile";
import {
	getAvailableModels,
	modelSupportsVision,
} from "@/server/opencode/models";
import { getProvidersIndex } from "@/server/opencode/modelsDev";

const PROVIDERS_LIST_TTL_MS = 5 * 60_000;
const PROVIDERS_CACHE_PREFIX = "cache:v1:action:providers.list:";
const AVAILABLE_MODELS_TTL_MS = 5 * 60_000;

interface AvailableModel {
	id: string;
	name: string;
	provider: string;
	vendor: string;
	supportsImages: boolean;
}

export const providers = {
	list: defineAction({
		handler: cachedAction(
			"providers.list",
			{ ttlMs: PROVIDERS_LIST_TTL_MS },
			async () => {
				const providersList = await getProvidersIndex();
				const connectedIds = await listConnectedProviderIds();

				const mapped = providersList.map((p) => ({
					id: p.id,
					name: p.name,
					env: p.env,
					connected: connectedIds.includes(p.id),
				}));

				return { providers: mapped };
			},
		),
	}),

	connect: defineAction({
		input: z.object({
			providerId: z.string().min(1, "Provider ID is required"),
			apiKey: z.string().min(1, "API key is required"),
		}),
		handler: async (input) => {
			const validationResult = await validateApiKey(
				input.providerId,
				input.apiKey,
			);

			if (!validationResult.valid) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message:
						validationResult.error ||
						"Failed to validate API key. Please check your key and try again.",
				});
			}

			await setApiKey(input.providerId, input.apiKey);
			invalidatePrefix(PROVIDERS_CACHE_PREFIX);
			return { success: true };
		},
	}),

	disconnect: defineAction({
		input: z.object({
			providerId: z.string().min(1, "Provider ID is required"),
		}),
		handler: async (input) => {
			await removeProvider(input.providerId);
			invalidatePrefix(PROVIDERS_CACHE_PREFIX);
			return { success: true };
		},
	}),

	getAvailableModelsForUser: defineAction({
		handler: cachedAction(
			"providers.getAvailableModelsForUser",
			{ ttlMs: AVAILABLE_MODELS_TTL_MS },
			async (): Promise<{ models: AvailableModel[] }> => {
				try {
					const connectedProviderIds = await listConnectedProviderIds();

					if (connectedProviderIds.length === 0) {
						return { models: [] };
					}

					// Get all available models from connected providers
					const availableModels =
						await getAvailableModels(connectedProviderIds);

					// Filter to only include curated models
					const filteredModels = availableModels.filter((model) =>
						CURATED_MODELS.some(
							(curatedModelId) => curatedModelId === model.id,
						),
					);

					// Enrich with vision support data
					const enrichedModels: AvailableModel[] = [];
					for (const model of filteredModels) {
						const supportsImages = await modelSupportsVision(model.id);
						enrichedModels.push({
							id: model.id,
							name: model.name,
							provider: model.provider,
							vendor: model.vendor,
							supportsImages,
						});
					}

					return { models: enrichedModels };
				} catch (error) {
					logger.error({ error }, "Failed to get available models for user");
					return { models: [] };
				}
			},
		),
	}),
};
