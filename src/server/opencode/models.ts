import { toVendorSlug } from "@/lib/modelVendor";
import { logger } from "@/server/logger";
import { getModelById, getModelsIndex } from "./modelsDev";

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

/**
 * Normalize model IDs from models.dev for each provider.
 * Returns the model ID as-is (matching models.dev format) and infers vendor for display.
 *
 * Key insight: OpenCode SDK expects model IDs without vendor prefix, while OpenRouter
 * expects model IDs with vendor prefix. This function just returns the canonical format
 * from models.dev and infers the vendor name for UI grouping.
 *
 * Examples:
 * - OpenCode "claude-haiku-4-5" → { id: "claude-haiku-4-5", vendor: "anthropic" }
 * - OpenRouter "openai/gpt-5.2" → { id: "openai/gpt-5.2", vendor: "openai" }
 */
function normalizeModelId(
	modelId: string,
	providerId: string,
): { id: string; vendor: string } {
	return { id: modelId, vendor: resolveModelVendor(providerId, modelId) };
}

/**
 * Get all available models from connected providers, sorted by input cost (cheapest first)
 */
export async function getAvailableModels(
	connectedProviderIds: string[],
): Promise<
	Array<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
	}>
> {
	if (connectedProviderIds.length === 0) {
		return [];
	}

	const allModels = await getModelsIndex();
	const available: Array<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		cost: number;
	}> = [];

	for (const providerId of connectedProviderIds) {
		const providerModels = allModels[providerId];
		if (providerModels) {
			for (const model of providerModels) {
				const { id, vendor } = normalizeModelId(model.id, providerId);
				available.push({
					id,
					name: model.name,
					provider: providerId,
					vendor,
					cost: model.cost.input ?? 0,
				});
			}
		}
	}

	// Sort by cost (cheapest first)
	available.sort((a, b) => a.cost - b.cost);

	return available.map(({ id, name, provider, vendor }) => ({
		id,
		name,
		provider,
		vendor,
	}));
}

/**
 * Get the fastest/cheapest model suitable for auto-naming from available providers
 */
export async function getAutonameModel(
	connectedProviderIds: string[],
): Promise<string | null> {
	const available = await getAvailableModels(connectedProviderIds);

	if (available.length === 0) {
		logger.warn(
			{ connectedProviderIds },
			"No available models for autoname selection",
		);
		return null;
	}

	// Return the ID of the first (cheapest) model
	return available[0]?.id ?? null;
}

/**
 * Check if a model supports vision (has "image" in input modalities)
 */
export async function modelSupportsVision(modelId: string): Promise<boolean> {
	const model = await getModelById(modelId);
	if (!model) {
		return false;
	}

	return model.modalities.input.includes("image");
}

/**
 * Get comprehensive capabilities for a model
 */
export async function getModelCapabilities(
	modelId: string,
): Promise<ModelCapabilities | null> {
	const model = await getModelById(modelId);
	if (!model) {
		return null;
	}

	return {
		supportsVision: model.modalities.input.includes("image"),
		supportedInputTypes: model.modalities.input,
		inputCost: model.cost.input ?? 0,
		contextLimit: model.limit.context ?? 0,
	};
}
