import { Effect } from "effect";
import { toVendorSlug } from "@/lib/modelVendor";
import { ModelsFetchError } from "@/server/effect/errors";
import { logger } from "@/server/logger";
import { getOpencodeClient } from "./client";

export interface ModelCapabilities {
	supportsVision: boolean;
	supportedInputTypes: string[];
	inputCost: number;
	contextLimit: number;
}

const MODEL_VENDOR_PATTERNS: Array<{ pattern: RegExp; vendor: string }> = [
	{ pattern: /^gpt[-_]/, vendor: "openai" },
	{ pattern: /^claude[-_]/, vendor: "anthropic" },
	{ pattern: /^gemini[-_]/, vendor: "google" },
	{ pattern: /^grok[-_]/, vendor: "xai" },
	{ pattern: /(^|[-_])kimi([-_.]|$)/, vendor: "moonshot" },
	{ pattern: /^glm[-_]/, vendor: "z-ai" },
];

const MULTI_VENDOR_PROVIDERS = new Set(["openrouter", "opencode"]);

function extractVendorFromModelId(modelId: string): string | null {
	const separatorIndex = modelId.indexOf("/");
	if (separatorIndex <= 0) {
		return null;
	}

	const vendorPart = modelId.slice(0, separatorIndex);
	if (!vendorPart) {
		return null;
	}

	return toVendorSlug(vendorPart);
}

function inferVendorFromModelId(modelId: string): string | null {
	const normalizedModelId = modelId.trim().toLowerCase();

	for (const { pattern, vendor } of MODEL_VENDOR_PATTERNS) {
		if (pattern.test(normalizedModelId)) {
			return vendor;
		}
	}

	return null;
}

export function resolveModelVendor(
	providerId: string,
	modelId: string,
): string {
	const normalizedProvider = toVendorSlug(providerId);
	const vendorFromModelId = extractVendorFromModelId(modelId);

	if (!MULTI_VENDOR_PROVIDERS.has(normalizedProvider)) {
		return normalizedProvider;
	}

	return (
		vendorFromModelId ?? inferVendorFromModelId(modelId) ?? normalizedProvider
	);
}

interface OpencodeModel {
	id: string;
	providerID: string;
	name: string;
	family?: string;
	capabilities: {
		temperature: boolean;
		reasoning: boolean;
		attachment: boolean;
		toolcall: boolean;
		input: {
			text: boolean;
			audio: boolean;
			image: boolean;
			video: boolean;
			pdf: boolean;
		};
		output: {
			text: boolean;
			audio: boolean;
			image: boolean;
			video: boolean;
			pdf: boolean;
		};
		interleaved: boolean | { field: string };
	};
	cost: {
		input: number;
		output: number;
		cache: {
			read: number;
			write: number;
		};
	};
	limit: {
		context: number;
		input?: number;
		output: number;
	};
	status: "alpha" | "beta" | "deprecated" | "active";
}

interface OpencodeProvider {
	id: string;
	name: string;
	models: Record<string, OpencodeModel>;
}

/**
 * Get all available models from connected providers via OpenCode, sorted by input cost (cheapest first)
 */
export async function getAvailableModels(): Promise<
	Array<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
	}>
> {
	return Effect.runPromise(
		Effect.tryPromise({
			try: async () => {
				const client = getOpencodeClient();
				const response = await client.config.providers();

				if (!response.data?.providers) {
					logger.warn("No providers returned from OpenCode");
					return [];
				}

				const available: Array<{
					id: string;
					name: string;
					provider: string;
					vendor: string;
					supportsImages: boolean;
					cost: number;
				}> = [];

				for (const provider of response.data.providers as OpencodeProvider[]) {
					if (!provider?.models) {
						continue;
					}

					for (const [modelId, model] of Object.entries(provider.models)) {
						const vendor = resolveModelVendor(provider.id, modelId);
						available.push({
							id: modelId,
							name: model.name || modelId,
							provider: provider.id,
							vendor,
							supportsImages: model.capabilities?.input?.image ?? false,
							cost: model.cost?.input ?? 0,
						});
					}
				}

				available.sort((a, b) => a.cost - b.cost);

				return available.map(
					({ id, name, provider, vendor, supportsImages }) => ({
						id,
						name,
						provider,
						vendor,
						supportsImages,
					}),
				);
			},
			catch: (error) =>
				new ModelsFetchError({
					source: "models.ts:getAvailableModels",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		}),
	);
}

/**
 * Get the fastest/cheapest model suitable for auto-naming from available providers
 */
export async function getAutonameModel(): Promise<string | null> {
	return Effect.runPromise(
		Effect.tryPromise({
			try: async () => {
				const available = await getAvailableModels();

				if (available.length === 0) {
					logger.warn("No available models for autoname selection");
					return null;
				}

				return available[0]?.id ?? null;
			},
			catch: (error) =>
				new ModelsFetchError({
					source: "models.ts:getAutonameModel",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		}),
	);
}

/**
 * Check if a model supports vision (has "image" in input modalities)
 */
export async function modelSupportsVision(modelId: string): Promise<boolean> {
	return Effect.runPromise(
		Effect.tryPromise({
			try: async () => {
				const client = getOpencodeClient();
				const response = await client.config.providers();

				if (!response.data?.providers) {
					return false;
				}

				for (const provider of response.data.providers) {
					const models = (provider as OpencodeProvider).models;
					if (models?.[modelId]) {
						return models[modelId].capabilities?.input?.image ?? false;
					}
				}

				return false;
			},
			catch: (error) =>
				new ModelsFetchError({
					source: "models.ts:modelSupportsVision",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		}),
	);
}

/**
 * Get comprehensive capabilities for a model
 */
export async function getModelCapabilities(
	modelId: string,
): Promise<ModelCapabilities | null> {
	return Effect.runPromise(
		Effect.tryPromise({
			try: async () => {
				const client = getOpencodeClient();
				const response = await client.config.providers();

				if (!response.data?.providers) {
					return null;
				}

				for (const provider of response.data.providers) {
					const models = (provider as OpencodeProvider).models;
					const model = models?.[modelId];
					if (model) {
						return {
							supportsVision: model.capabilities?.input?.image ?? false,
							supportedInputTypes: Object.entries(
								model.capabilities?.input || {},
							)
								.filter(([, v]) => v)
								.map(([k]) => k),
							inputCost: model.cost?.input ?? 0,
							contextLimit: model.limit?.context ?? 0,
						};
					}
				}

				return null;
			},
			catch: (error) =>
				new ModelsFetchError({
					source: "models.ts:getModelCapabilities",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		}),
	);
}
