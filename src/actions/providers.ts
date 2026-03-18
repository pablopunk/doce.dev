import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { cachedAction } from "@/server/cache/actionCache";
import { invalidatePrefix } from "@/server/cache/memory";
import { logger } from "@/server/logger";
import { validateApiKey } from "@/server/opencode/apiKeyValidation";
import { listConnectedProviderIds } from "@/server/opencode/authFile";
import { getOpencodeClient } from "@/server/opencode/client";
import {
	getAvailableModels,
	modelSupportsVision,
} from "@/server/opencode/models";

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

interface ProviderAuthMethod {
	type: "api" | "oauth";
	label: string;
}

function getProviderMethods(
	provider: { env?: string[] },
	methods: ProviderAuthMethod[] | undefined,
): ProviderAuthMethod[] {
	if (methods && methods.length > 0) {
		return methods;
	}

	if ((provider.env || []).length > 0) {
		return [{ type: "api", label: "Manually enter API Key" }];
	}

	return [];
}

function filterVisibleProviders<T extends { id: string }>(providers: T[]): T[] {
	return providers.filter((provider) => provider.id !== "opencode");
}

export const providers = {
	list: defineAction({
		handler: cachedAction(
			"providers.list",
			{ ttlMs: PROVIDERS_LIST_TTL_MS },
			async () => {
				const client = getOpencodeClient();
				const [providerResponse, authResponse] = await Promise.all([
					client.provider.list(),
					client.provider.auth(),
				]);

				const providerData = providerResponse.data;
				const authData = authResponse.data || {};
				const connectedIds = new Set(await listConnectedProviderIds());

				const mapped = filterVisibleProviders(providerData?.all || []).map(
					(provider) => ({
						id: provider.id,
						name: provider.name,
						env: provider.env,
						connected: connectedIds.has(provider.id),
						methods: getProviderMethods(
							provider,
							(authData[provider.id] || []) as ProviderAuthMethod[],
						),
					}),
				);

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

			const client = getOpencodeClient();
			const result = await client.auth.set({
				providerID: input.providerId,
				auth: {
					type: "api",
					key: input.apiKey,
				},
			});

			if (result.error) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Failed to save provider credentials in OpenCode.",
				});
			}

			invalidatePrefix(PROVIDERS_CACHE_PREFIX);
			return { success: true };
		},
	}),

	disconnect: defineAction({
		input: z.object({
			providerId: z.string().min(1, "Provider ID is required"),
		}),
		handler: async (input) => {
			const client = getOpencodeClient();
			await client.auth.remove({ providerID: input.providerId });
			invalidatePrefix(PROVIDERS_CACHE_PREFIX);
			return { success: true };
		},
	}),

	startOauth: defineAction({
		input: z.object({
			providerId: z.string().min(1, "Provider ID is required"),
			methodIndex: z.number().int().min(0, "Method index is required"),
		}),
		handler: async (input) => {
			const client = getOpencodeClient();
			const result = await client.provider.oauth.authorize({
				providerID: input.providerId,
				method: input.methodIndex,
			});

			if (result.error || !result.data) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Failed to start OAuth authorization.",
				});
			}

			return { authorization: result.data };
		},
	}),

	finishOauth: defineAction({
		input: z.object({
			providerId: z.string().min(1, "Provider ID is required"),
			methodIndex: z.number().int().min(0, "Method index is required"),
			code: z.string().optional(),
		}),
		handler: async (input) => {
			const client = getOpencodeClient();
			const result = await client.provider.oauth.callback({
				providerID: input.providerId,
				method: input.methodIndex,
				...(input.code ? { code: input.code } : {}),
			});

			if (result.error) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "OAuth authorization did not complete successfully.",
				});
			}

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

					// Enrich with vision support data
					const enrichedModels: AvailableModel[] = [];
					for (const model of availableModels) {
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
