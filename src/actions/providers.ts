import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { cachedAction } from "@/server/cache/actionCache";
import { invalidatePrefix } from "@/server/cache/memory";
import { logger } from "@/server/logger";
import type { OpencodeClient } from "@/server/opencode/client";
import { createOpencodeClient } from "@/server/opencode/client";
import { getAvailableModels } from "@/server/opencode/models";
import {
	getSettingsProviders,
	OPENCODE_PROVIDER_ID,
	OPENCODE_SIBLING_ID,
} from "@/server/providers/provider-list";

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
	supportsAttachments: boolean;
}

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

/** Trigger a runtime reload so auth changes are picked up by provider.list() */
async function reloadRuntimeAfterAuthChange(
	client: OpencodeClient,
): Promise<void> {
	try {
		await client.global.dispose();
	} catch (error) {
		logger.warn({ error }, "Runtime dispose after auth change failed");
	}
}

export const providers = {
	list: defineAction({
		handler: cachedAction(
			"providers.list",
			{ ttlMs: PROVIDERS_LIST_TTL_MS },
			async () => ({ providers: await getSettingsProviders() }),
		),
	}),

	connect: defineAction({
		input: z.object({
			providerId: z.string().min(1, "Provider ID is required"),
			apiKey: z.string().min(1, "API key is required"),
		}),
		handler: async (input) => {
			const client = createOpencodeClient();
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
			await reloadRuntimeAfterAuthChange(client);

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
			const client = createOpencodeClient();
			const result = await client.auth.remove({ providerID: input.providerId });

			if (result.error) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Failed to remove provider credentials from OpenCode.",
				});
			}

			await syncOpencodeDisconnect(client, input.providerId);
			await reloadRuntimeAfterAuthChange(client);

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
			const client = createOpencodeClient();
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
			const client = createOpencodeClient();
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

			await reloadRuntimeAfterAuthChange(client);

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
