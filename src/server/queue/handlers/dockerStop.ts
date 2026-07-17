import { composeStop } from "@/server/docker/compose";
import type { LegacyHandler } from "@/server/effect/handler-adapter";
import { getProjectPreviewPath } from "@/server/projects/paths";
import {
	getProjectByIdIncludeDeleted,
	updateProjectDesiredStatus,
	updateProjectObservedStatus,
} from "@/server/projects/projects.model";
import { parsePayload } from "../types";

export const handleDockerStop: LegacyHandler = async (ctx) => {
	const payload = parsePayload("docker.stop", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		return;
	}

	if (project.desiredStatus === "deleting") {
		return;
	}

	await updateProjectDesiredStatus(project.id, "stopped");

	await ctx.throwIfCancelRequested();

	const previewPath = getProjectPreviewPath(project.id);
	const result = await composeStop(project.id, previewPath);

	if (result.success) {
		await updateProjectObservedStatus(project.id, "missing");
	} else {
		await updateProjectObservedStatus(project.id, "unhealthy");
		throw new Error(`compose stop failed: ${result.stderr.slice(0, 500)}`);
	}
};
