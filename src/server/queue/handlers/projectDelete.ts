import * as fs from "node:fs/promises";
import { logger } from "@/server/logger";
import { composeDownWithVolumes } from "@/server/docker/compose";
import {
	getProjectByIdIncludeDeleted,
	hardDeleteProject,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

export async function handleProjectDelete(ctx: QueueJobContext): Promise<void> {
	const payload = parsePayload("project.delete", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		return;
	}

	await ctx.throwIfCancelRequested();

	try {
		await updateProjectStatus(project.id, "deleting");
	} catch {
		// ignore
	}

	await ctx.throwIfCancelRequested();

	try {
		await composeDownWithVolumes(project.id, project.pathOnDisk);
	} catch (error) {
		logger.warn(
			{ error, projectId: project.id },
			"compose down with volumes failed during delete",
		);
	}

	await ctx.throwIfCancelRequested();

	try {
		await fs.rm(project.pathOnDisk, { recursive: true, force: true });
	} catch (error) {
		logger.warn({ error, projectId: project.id }, "fs rm failed during delete");
	}

	await ctx.throwIfCancelRequested();

	await hardDeleteProject(project.id);
	logger.info({ projectId: project.id }, "Project hard-deleted");
}
