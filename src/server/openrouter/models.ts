import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import {
	getProjectPath,
	getProjectRelativePath,
	getProjectsPath,
	getTemplatePath,
} from "@/server/projects/paths";

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

async function writeProjectImages(
	projectPath: string,
	images: Array<{ filename: string; mime: string; dataUrl: string }>,
): Promise<void> {
	const imagesPath = path.join(projectPath, ".doce-images.json");
	await fs.writeFile(imagesPath, JSON.stringify(images));
}

async function ensureOpencodeDir(): Promise<void> {
	await fs.mkdir(path.join(process.cwd(), "data", "opencode"), {
		recursive: true,
	});
}

export const DEFAULT_MODEL = "openrouter/google/gemini-2.5-flash" as ModelId;
export const FAST_MODEL = "google/gemini-2.5-flash" as ModelId;

const DEFAULT_MODEL_VALUE = "anthropic/claude-haiku-4.5" as ModelId;

export const AVAILABLE_MODELS = [
	{
		id: "openai/gpt-5.2",
		name: "GPT-5.2",
		provider: "OpenAI",
		tier: "top",
		supportsImages: true,
	},
	{
		id: "anthropic/claude-haiku-4.5",
		name: "Claude Opus 4.5",
		provider: "Anthropic",
		tier: "top",
		supportsImages: true,
	},
	{
		id: "openai/gpt-4.1",
		name: "GPT-4.1 Mini",
		provider: "OpenAI",
		tier: "fast",
		supportsImages: false,
	},
] as const;
