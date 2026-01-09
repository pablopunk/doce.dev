export * from "./projects.db";
export * from "./projects.config";

import { updateOpencodeJsonModel } from "./projects.config";

/**
 * Update project model.
 * Updates opencode.json so OpenCode uses the selected model.
 */
export async function updateProjectModel(
	id: string,
	model: string | null, // e.g., "openrouter/google/gemini-3-flash"
): Promise<void> {
	if (model) {
		await updateOpencodeJsonModel(id, model);
	}
}
