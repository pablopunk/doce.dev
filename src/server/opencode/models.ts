import { logger } from "@/server/logger";
import { getModelById, getModelsIndex } from "./modelsDev";

export interface ModelCapabilities {
	supportsVision: boolean;
	supportedInputTypes: string[];
	inputCost: number;
	contextLimit: number;
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
	// For openrouter, models are already in vendor/model format
	// Return as-is and extract vendor from the ID
	if (providerId === "openrouter") {
		// Extract vendor from the model ID (first part before /)
		const parts = modelId.split("/");
		const vendor = parts[0] ?? modelId;
		return { id: modelId, vendor };
	}

	// If already in vendor/model format, return as-is (for other providers with vendor prefix)
	if (modelId.includes("/")) {
		const parts = modelId.split("/");
		const vendor = parts[0]!;
		return { id: modelId, vendor };
	}

	// For opencode provider, models don't have vendor prefix in their ID
	// Infer vendor from model name for display/grouping purposes only
	if (providerId === "opencode") {
		if (modelId.startsWith("gpt-") || modelId.startsWith("gpt_")) {
			return { id: modelId, vendor: "openai" };
		}
		if (modelId.startsWith("claude-")) {
			return { id: modelId, vendor: "anthropic" };
		}
		if (modelId.startsWith("gemini-")) {
			return { id: modelId, vendor: "google" };
		}
		if (modelId.startsWith("grok-")) {
			return { id: modelId, vendor: "xai" };
		}
		if (modelId.includes("kimi") || modelId.startsWith("kimi-")) {
			return { id: modelId, vendor: "moonshot" };
		}
		// Default: use the model ID as vendor if no match
		return { id: modelId, vendor: modelId };
	}

	// For other providers, use the first part of the model ID as vendor if available
	const parts = modelId.split("/");
	const vendor = parts[0] ?? modelId;

	return { id: modelId, vendor };
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
	return available[0]!.id;
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
