import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { cachedAction } from "@/server/cache/actionCache";
import { invalidatePrefix } from "@/server/cache/memory";
import { getProvidersIndex } from "@/server/opencode/modelsDev";
import {
	listConnectedProviderIds,
	setApiKey,
	removeProvider,
} from "@/server/opencode/authFile";

const PROVIDERS_LIST_TTL_MS = 5 * 60_000;
const PROVIDERS_CACHE_PREFIX = "cache:v1:action:providers.list:";

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
};
