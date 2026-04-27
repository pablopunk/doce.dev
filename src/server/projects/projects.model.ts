export * from "./projects.config";
export * from "./projects.db";

import { updateOpencodeJsonModel } from "./projects.config";
import { updateProjectModelInDb } from "./projects.db";

/**
 * Update project model.
 * Persists to DB (preferred_model) and updates opencode.json so OpenCode uses it.
 */
export async function updateProjectModel(
	id: string,
	model: string | null, // e.g., "openrouter/google/gemini-3-flash"
): Promise<void> {
	await updateProjectModelInDb(id, model);
	if (model) {
		await updateOpencodeJsonModel(id, model);
	}
}
