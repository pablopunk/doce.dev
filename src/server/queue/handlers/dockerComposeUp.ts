import { logger } from "@/server/logger";
import { composeUp } from "@/server/docker/compose";
import { getProjectByIdIncludeDeleted, updateProjectStatus, updateProjectSetupPhase } from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { enqueueDockerWaitReady } from "../enqueue";

export async function handleDockerComposeUp(ctx: QueueJobContext): Promise<void> {
  const payload = parsePayload("docker.composeUp", ctx.job.payloadJson);

  const project = await getProjectByIdIncludeDeleted(payload.projectId);
  if (!project) {
    logger.warn({ projectId: payload.projectId }, "Project not found for docker.composeUp");
    return;
  }

  if (project.status === "deleting") {
    logger.info({ projectId: project.id }, "Skipping docker.composeUp for deleting project");
    return;
  }

  try {
    await updateProjectStatus(project.id, "starting");
    await updateProjectSetupPhase(project.id, "starting_docker");

    await ctx.throwIfCancelRequested();

    const result = await composeUp(project.id, project.pathOnDisk);
    if (!result.success) {
      await updateProjectStatus(project.id, "error");
      await updateProjectSetupPhase(project.id, "failed");
      throw new Error(`compose up failed: ${result.stderr.slice(0, 500)}`);
    }

    logger.info({ projectId: project.id }, "Docker compose up succeeded");

    // Enqueue next step: wait for services to be ready
    await enqueueDockerWaitReady({
      projectId: project.id,
      startedAt: Date.now(),
    });

    logger.debug({ projectId: project.id }, "Enqueued docker.waitReady");
  } catch (error) {
    await updateProjectSetupPhase(project.id, "failed");
    throw error;
  }
}
