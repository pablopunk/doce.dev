import { composeDown } from "@/server/docker/compose";
import {
	getProjectByIdIncludeDeleted,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

export async function handleDockerStop(ctx: QueueJobContext): Promise<void> {
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

	const result = await composeDown(project.id, project.pathOnDisk);

	if (result.success) {
		await updateProjectStatus(project.id, "stopped");
	} else {
		await updateProjectStatus(project.id, "error");
		throw new Error(`compose down failed: ${result.stderr.slice(0, 500)}`);
	}
}
