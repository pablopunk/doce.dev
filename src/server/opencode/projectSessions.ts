import type { Project } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { getProjectPreviewPathFromRoot } from "@/server/projects/paths";
import { createOpencodeClient } from "./client";

/**
 * Delete a project's bootstrap session from the central OpenCode runtime.
 * Best-effort: failures are logged and swallowed by the caller if desired.
 */
export async function deleteProjectBootstrapSession(
	project: Pick<Project, "id" | "pathOnDisk" | "bootstrapSessionId">,
): Promise<void> {
	if (!project.bootstrapSessionId) {
		return;
	}

	const client = createOpencodeClient(
		getProjectPreviewPathFromRoot(project.pathOnDisk),
	);

	await client.session.delete({ sessionID: project.bootstrapSessionId });

	logger.debug(
		{
			projectId: project.id,
			sessionId: project.bootstrapSessionId,
		},
		"Deleted project OpenCode session from central runtime",
	);
}
