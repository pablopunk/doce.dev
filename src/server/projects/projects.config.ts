import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import {
	getProjectPreviewOpencodePath,
	getTemplatePath,
} from "@/server/projects/paths";

interface OpencodeConfig {
	model?: string;
	small_model?: string;
	provider?: Record<string, unknown>;
	instructions?: string[];
	[key: string]: unknown;
}

const OPENCODE_FILENAME = "opencode.json";

async function ensurePreviewOpencodeJson(projectId: string): Promise<void> {
	const previewPath = getProjectPreviewOpencodePath(projectId);
	try {
		await fs.access(previewPath);
		return;
	} catch (error) {
		try {
			await fs.mkdir(path.dirname(previewPath), { recursive: true });
			const templatePath = path.join(getTemplatePath(), OPENCODE_FILENAME);
			await fs.copyFile(templatePath, previewPath);
			logger.debug(
				{ projectId, path: previewPath },
				"Initialized preview opencode.json from template",
			);
		} catch (copyError) {
			logger.error(
				{
					projectId,
					error: String(copyError),
				},
				"Failed to initialize preview opencode.json",
			);
			throw copyError;
		}
	}
}

/**
 * Load opencode.json configuration from a project directory.
 */
export async function loadOpencodeConfig(
	projectId: string,
): Promise<OpencodeConfig | null> {
	try {
		await ensurePreviewOpencodeJson(projectId);
		const configPath = getProjectPreviewOpencodePath(projectId);
		const content = await fs.readFile(configPath, "utf-8");
		return JSON.parse(content) as OpencodeConfig;
	} catch (error) {
		logger.debug(
			{ projectId, error: String(error) },
			"Could not load preview/opencode.json",
		);
		return null;
	}
}

/**
 * Parse provider-prefixed model string into components.
 * Format: "provider/model-id" (e.g., "openrouter/google/gemini-3-flash")
 */
export function parseModelString(
	modelString: string,
): { providerID: string; modelID: string } | null {
	try {
		const parts = modelString.split("/");
		if (parts.length < 2) {
			return null;
		}
		const providerID = parts[0];
		const modelID = parts.slice(1).join("/");
		if (!providerID || !modelID) {
			return null;
		}
		return { providerID, modelID };
	} catch {
		return null;
	}
}

/**
 * Update the model field in opencode.json for a project.
 */
export async function updateOpencodeJsonModel(
	projectId: string,
	newModel: string,
): Promise<void> {
	const configPath = getProjectPreviewOpencodePath(projectId);
	await ensurePreviewOpencodeJson(projectId);

	try {
		const content = await fs.readFile(configPath, "utf-8");
		const config = JSON.parse(content) as Record<string, unknown>;

		config.model = newModel;

		await fs.writeFile(configPath, JSON.stringify(config, null, 2));

		logger.debug(
			{ projectId, newModel },
			"Updated preview/opencode.json model",
		);
	} catch (error) {
		logger.error(
			{ projectId, newModel, error: String(error) },
			"Failed to update preview/opencode.json model",
		);
		throw error;
	}
}
