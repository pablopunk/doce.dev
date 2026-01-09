import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";

interface OpencodeConfig {
	model?: string;
	small_model?: string;
	provider?: Record<string, unknown>;
	instructions?: string[];
	[key: string]: unknown;
}

/**
 * Load opencode.json configuration from a project directory.
 */
export async function loadOpencodeConfig(
	projectPath: string,
): Promise<OpencodeConfig | null> {
	try {
		const configPath = path.join(projectPath, "opencode.json");
		const content = await fs.readFile(configPath, "utf-8");
		return JSON.parse(content) as OpencodeConfig;
	} catch {
		logger.debug({ projectPath }, "Could not load opencode.json");
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
	const projectPath = path.join(process.cwd(), "data", "projects", projectId);
	const opencodeJsonPath = path.join(projectPath, "opencode.json");

	try {
		const content = await fs.readFile(opencodeJsonPath, "utf-8");
		const config = JSON.parse(content) as Record<string, unknown>;

		config.model = newModel;

		await fs.writeFile(opencodeJsonPath, JSON.stringify(config, null, 2));

		logger.debug({ projectId, newModel }, "Updated opencode.json model");
	} catch (error) {
		logger.error(
			{ projectId, newModel, error: String(error) },
			"Failed to update opencode.json model",
		);
		throw error;
	}
}
