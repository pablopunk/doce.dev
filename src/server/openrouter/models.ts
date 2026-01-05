import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";

export interface OpencodeConfig {
	model?: string;
	small_model?: string;
	provider?: Record<string, unknown>;
	instructions?: string[];
	[key: string]: unknown;
}

export type ModelId = string;

/**
 * Load opencode.json configuration from a project directory.
 */
export async function loadConfig(): Promise<OpencodeConfig | null> {
	const opencodeJsonPath = path.join(
		process.cwd(),
		"data",
		"opencode",
		"auth.json",
	);

	try {
		const content = await fs.readFile(opencodeJsonPath, "utf-8");
		const config = JSON.parse(content) as OpencodeConfig;
		return {
			model: config.model,
			small_model: config.small_model,
			provider: config.provider,
			instructions: config.instructions,
		};
	} catch {
		logger.debug({ opencodeJsonPath }, "Could not load opencode.json");
		return {
			model: undefined,
			small_model: undefined,
			provider: {},
			instructions: [],
		};
	}
}

export async function storeProjectModel(
	projectPath: string,
	model: string,
): Promise<void> {
	const opencodeJsonPath = path.join(projectPath, "opencode.json");

	try {
		const content = await fs.readFile(opencodeJsonPath, "utf-8");
		const config = JSON.parse(content) as OpencodeConfig;

		if (model) {
			config.model = model;
			if (!config.small_model) {
				config.small_model = model;
			}
		}
		config.instructions = ["./DOCE.md"];

		await fs.writeFile(opencodeJsonPath, JSON.stringify(config, null, 2));
	} catch (error) {
		logger.warn(
			{ projectPath, model, error: String(error) },
			"Failed to update opencode.json",
		);
	}
}

export const DEFAULT_MODEL = "google/gemini-3-flash-preview" as ModelId;
export const FAST_MODEL = "google/gemini-3-flash-preview" as ModelId;

/**
 * Curated list of recommended models.
 * The UI will filter these to only show models from connected providers.
 */
export const CURATED_MODELS = [
	{
		id: "openai/gpt-5.2",
		name: "GPT-5.2",
		provider: "OpenAI",
		tier: "top",
		supportsImages: true,
	},
	{
		id: "openai/gpt-4.1-mini",
		name: "GPT-4.1 Mini",
		provider: "OpenAI",
		tier: "fast",
		supportsImages: true,
	},
	{
		id: "anthropic/claude-haiku-4.5",
		name: "Claude Haiku 4.5",
		provider: "Anthropic",
		tier: "fast",
		supportsImages: true,
	},
	{
		id: "google/gemini-3-flash-preview",
		name: "Gemini 3 Flash Preview",
		provider: "Google",
		tier: "fast",
		supportsImages: true,
	},
] as const;

/**
 * @deprecated Use getAvailableModels() from models.ts instead.
 * This keeps backward compatibility but will be removed.
 */
export const AVAILABLE_MODELS = CURATED_MODELS;
