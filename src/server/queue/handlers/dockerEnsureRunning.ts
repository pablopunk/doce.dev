import { composeUp } from "@/server/docker/compose";
import { logger } from "@/server/logger";
import {
	checkOpencodeReady,
	checkPreviewReady,
} from "@/server/projects/health";
import {
	getProjectByIdIncludeDeleted,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { enqueueOpencodeSessionCreate } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

const START_MAX_WAIT_MS = 30_000;

export async function handleDockerEnsureRunning(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("docker.ensureRunning", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		return;
	}

	if (project.status === "deleting") {
		return;
	}

	await updateProjectStatus(project.id, "starting");

	await ctx.throwIfCancelRequested();

	const result = await composeUp(project.id, project.pathOnDisk);
	if (!result.success) {
		await updateProjectStatus(project.id, "error");
		throw new Error(`compose up failed: ${result.stderr.slice(0, 500)}`);
	}

	const startedAt = Date.now();

	while (Date.now() - startedAt < START_MAX_WAIT_MS) {
		await ctx.throwIfCancelRequested();

		const [previewReady, opencodeReady] = await Promise.all([
			checkPreviewReady(project.devPort),
			checkOpencodeReady(project.opencodePort),
		]);

		if (previewReady && opencodeReady) {
			await updateProjectStatus(project.id, "running");

			// After successful restart, check if we need to create a new session
			// Sessions are ephemeral and don't persist across container restarts
			try {
				// Check if any sessions exist
				const sessionUrl = `http://127.0.0.1:${project.opencodePort}/session`;
				const sessionsRes = await fetch(sessionUrl);

				if (sessionsRes.ok) {
					const sessions = (await sessionsRes.json()) as unknown[];
					const sessionsArray = Array.isArray(sessions) ? sessions : [];

					// If no sessions exist, create a new one (init is already done in template)
					if (sessionsArray.length === 0) {
						logger.info(
							{ projectId: project.id },
							"Sessions lost after restart, creating new session...",
						);
						await enqueueOpencodeSessionCreate({ projectId: project.id });
					}
				}
			} catch (error) {
				logger.warn(
					{ error, projectId: project.id },
					"Failed to check/restore sessions after restart",
				);
				// Don't fail the job, containers are up
			}

			return;
		}

		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	await updateProjectStatus(project.id, "error");
	logger.warn(
		{ projectId: project.id },
		"Timed out waiting for project readiness",
	);
	throw new Error("timed out waiting for preview/opencode readiness");
}
