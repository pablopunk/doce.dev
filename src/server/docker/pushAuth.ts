import * as fs from "node:fs/promises";
import { logger } from "@/server/logger";
import { getOpencodePath } from "@/server/projects/paths";
import { runCommand } from "@/server/utils/execAsync";

/**
 * Push auth.json from main app into an OpenCode container.
 * Uses `docker cp` to copy the file from the host into the container.
 *
 * @param projectId The project ID
 * @returns true if auth.json was pushed successfully, false otherwise
 */
export async function pushAuthToContainer(projectId: string): Promise<boolean> {
	const containerName = `doce_${projectId}-opencode-1`;
	const authPath = getOpencodePath(); // /app/data/opencode/auth.json

	try {
		// Check if auth.json exists
		await fs.access(authPath);
	} catch {
		logger.warn(
			{ projectId },
			"No auth.json found to push to OpenCode container",
		);
		return false;
	}

	try {
		// Ensure the target directory exists in the container
		const mkdirResult = await runCommand(
			`docker exec ${containerName} mkdir -p /root/.local/share/opencode`,
			{ timeout: 5000 },
		);

		if (!mkdirResult.success) {
			logger.error(
				{ projectId, stderr: mkdirResult.stderr },
				"Failed to create directory in OpenCode container",
			);
			return false;
		}

		// Copy auth.json to the container
		const cpResult = await runCommand(
			`docker cp "${authPath}" ${containerName}:/root/.local/share/opencode/auth.json`,
			{ timeout: 10000 },
		);

		if (!cpResult.success) {
			logger.error(
				{ projectId, stderr: cpResult.stderr },
				"Failed to push auth.json to OpenCode container via docker cp",
			);
			return false;
		}

		logger.info(
			{ projectId },
			"Successfully pushed auth.json to OpenCode container",
		);
		return true;
	} catch (error) {
		logger.error(
			{
				projectId,
				error: error instanceof Error ? error.message : String(error),
			},
			"Exception while pushing auth.json to OpenCode container",
		);
		return false;
	}
}
