import { composeStop } from "@/server/docker/compose";
import type { LegacyHandler } from "@/server/effect/handler-adapter";
import { getProjectPreviewPath } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { parsePayload } from "../types";

export const handleDockerStop: LegacyHandler = async (ctx) => {
	const payload = parsePayload("docker.stop", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		return;
	}

	if (project.status === "deleting") {
		return;
	}

	await updateProjectStatus(project.id, "stopping");

	await ctx.throwIfCancelRequested();

	const previewPath = getProjectPreviewPath(project.id);
	const result = await composeStop(project.id, previewPath);

	if (result.success) {
		await updateProjectStatus(project.id, "stopped");
	} else {
		await updateProjectStatus(project.id, "error");
		throw new Error(`compose stop failed: ${result.stderr.slice(0, 500)}`);
	}
};
