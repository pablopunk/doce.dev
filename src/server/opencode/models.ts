import { logger } from "@/server/logger";
import { getModelById, getModelsIndex } from "./modelsDev";

export interface ModelCapabilities {
	supportsVision: boolean;
	supportedInputTypes: string[];
	inputCost: number;
	contextLimit: number;
}

/**
 * Map opencode model IDs to normalized vendor/model format
 * opencode uses simple model names, we need to infer vendor from the model name
 */
function normalizeModelId(
	modelId: string,
	providerId: string,
): { id: string; vendor: string } {
	// For openrouter, models are already in vendor/model format
	// Don't add provider prefix - it's redundant (provider is tracked separately)
	if (providerId === "openrouter") {
		// Extract vendor from the model ID (first part before /)
		const parts = modelId.split("/");
		const vendor = parts[0] ?? modelId;
		return { id: modelId, vendor };
	}

	// If already in vendor/model format, return as-is (for non-openrouter providers)
	if (modelId.includes("/")) {
		const parts = modelId.split("/");
		const vendor = parts[0]!;
		return { id: modelId, vendor };
	}

	// For opencode provider, DON'T add vendor prefix - OpenCode SDK expects just the model name
	// The vendor prefix is only for display purposes in the UI
	// The SDK's normalizeModelId (in opencodeSendUserPrompt) will strip it anyway
	if (providerId === "opencode") {
		if (modelId.startsWith("gpt-") || modelId.startsWith("gpt_")) {
			return { id: `openai/${modelId}`, vendor: "openai" };
		}
		if (modelId.startsWith("claude-")) {
			return { id: `anthropic/${modelId}`, vendor: "anthropic" };
		}
		if (modelId.startsWith("gemini-")) {
			return { id: `google/${modelId}`, vendor: "google" };
		}
		if (modelId.startsWith("grok-")) {
			return { id: `xai/${modelId}`, vendor: "xai" };
		}
		if (modelId.includes("kimi") || modelId.startsWith("kimi-")) {
			return { id: `moonshot/${modelId}`, vendor: "moonshot" };
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
