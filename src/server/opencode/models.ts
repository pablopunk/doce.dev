import { getModelsIndex, getModelById } from "./modelsDev";
import { logger } from "@/server/logger";

export interface ModelCapabilities {
	supportsVision: boolean;
	supportedInputTypes: string[];
	inputCost: number;
	contextLimit: number;
}

/**
 * Get all available models from connected providers, sorted by input cost (cheapest first)
 */
export async function getAvailableModels(
	connectedProviderIds: string[],
): Promise<Array<{ id: string; name: string; provider: string }>> {
	if (connectedProviderIds.length === 0) {
		return [];
	}

	const allModels = await getModelsIndex();
	const available: Array<{
		id: string;
		name: string;
		provider: string;
		cost: number;
	}> = [];

	for (const providerId of connectedProviderIds) {
		const providerModels = allModels[providerId];
		if (providerModels) {
			for (const model of providerModels) {
				available.push({
					id: model.id,
					name: model.name,
					provider: providerId,
					cost: model.cost.input ?? 0,
				});
			}
		}
	}

	// Sort by cost (cheapest first)
	available.sort((a, b) => a.cost - b.cost);

	return available.map(({ id, name, provider }) => ({
		id,
		name,
		provider,
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
