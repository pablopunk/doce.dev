import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { cachedAction } from "@/server/cache/actionCache";
import { invalidatePrefix } from "@/server/cache/memory";
import { logger } from "@/server/logger";
import { validateApiKey } from "@/server/opencode/apiKeyValidation";
import type { OpencodeClient } from "@/server/opencode/client";
import { getOpencodeClient } from "@/server/opencode/client";
import { getAvailableModels } from "@/server/opencode/models";

const PROVIDERS_LIST_TTL_MS = 5 * 60_000;
const PROVIDERS_CACHE_PREFIX = "cache:v1:action:providers.list:";
const AVAILABLE_MODELS_TTL_MS = 5 * 60_000;
const AVAILABLE_MODELS_CACHE_PREFIX =
	"cache:v1:action:providers.getAvailableModelsForUser:";

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

type ProviderSource = "env" | "config" | "custom" | "api";

function getProviderMethods(
	provider: { id?: string; env?: string[] },
	methods: ProviderAuthMethod[] | undefined,
): ProviderAuthMethod[] {
	if (methods && methods.length > 0) {
		return methods;
	}

	if (provider.id === OPENCODE_PROVIDER_ID) {
		return [{ type: "api", label: "Enter OpenCode Zen/Go API Key" }];
	}

	if ((provider.env || []).length > 0) {
		return [{ type: "api", label: "Manually enter API Key" }];
	}

	return [];
}

/** opencode-go shares credentials with opencode; hide it and sync keys automatically */
const OPENCODE_PROVIDER_ID = "opencode";
const OPENCODE_SIBLING_ID = "opencode-go";
const HIDDEN_PROVIDER_IDS = new Set([OPENCODE_SIBLING_ID]);

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
	[OPENCODE_PROVIDER_ID]: "OpenCode Zen/Go",
};

async function syncOpencodeCredentials(
	client: OpencodeClient,
	providerId: string,
	auth: { type: "api"; key: string },
): Promise<void> {
	if (providerId !== OPENCODE_PROVIDER_ID) return;
	try {
		await client.auth.set({ providerID: OPENCODE_SIBLING_ID, auth });
	} catch (error) {
		logger.warn({ error }, "Failed to sync credentials to opencode-go");
	}
}

async function syncOpencodeDisconnect(
	client: OpencodeClient,
	providerId: string,
): Promise<void> {
	if (providerId !== OPENCODE_PROVIDER_ID) return;
	try {
		await client.auth.remove({ providerID: OPENCODE_SIBLING_ID });
	} catch (error) {
		logger.warn({ error }, "Failed to sync disconnect to opencode-go");
	}
}

/** A provider is connected if the runtime reports it in the connected array. */
function isProviderConnected(
	providerId: string,
	connectedIds: Set<string>,
): boolean {
	return connectedIds.has(providerId);
}

function filterVisibleProviders<T extends { id: string }>(providers: T[]): T[] {
	return providers.filter((provider) => !HIDDEN_PROVIDER_IDS.has(provider.id));
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
				const connectedIds = new Set(providerData?.connected || []);

				const mapped = filterVisibleProviders(providerData?.all || []).map(
					(provider) => ({
						id: provider.id,
						name: PROVIDER_DISPLAY_NAMES[provider.id] ?? provider.name,
						env: provider.env,
						source: (provider.source || "custom") as ProviderSource,
						connected: isProviderConnected(provider.id, connectedIds),
						disconnectable: connectedIds.has(provider.id),
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
			const authPayload = { type: "api" as const, key: input.apiKey };

			const result = await client.auth.set({
				providerID: input.providerId,
				auth: authPayload,
			});

			if (result.error) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Failed to save provider credentials in OpenCode.",
				});
			}

			await syncOpencodeCredentials(client, input.providerId, authPayload);

			invalidatePrefix(PROVIDERS_CACHE_PREFIX);
			invalidatePrefix(AVAILABLE_MODELS_CACHE_PREFIX);
			return { success: true };
		},
	}),

	disconnect: defineAction({
		input: z.object({
			providerId: z.string().min(1, "Provider ID is required"),
		}),
		handler: async (input) => {
			const client = getOpencodeClient();
			const result = await client.auth.remove({ providerID: input.providerId });

			if (result.error) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Failed to remove provider credentials from OpenCode.",
				});
			}

			await syncOpencodeDisconnect(client, input.providerId);
			invalidatePrefix(PROVIDERS_CACHE_PREFIX);
			invalidatePrefix(AVAILABLE_MODELS_CACHE_PREFIX);
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
			invalidatePrefix(AVAILABLE_MODELS_CACHE_PREFIX);
			return { success: true };
		},
	}),

	getAvailableModelsForUser: defineAction({
		handler: cachedAction(
			"providers.getAvailableModelsForUser",
			{ ttlMs: AVAILABLE_MODELS_TTL_MS },
			async (): Promise<{ models: AvailableModel[] }> => {
				try {
					const availableModels = await getAvailableModels();
					return { models: availableModels };
				} catch (error) {
					logger.error({ error }, "Failed to get available models for user");
					return { models: [] };
				}
			},
		),
	}),
};
