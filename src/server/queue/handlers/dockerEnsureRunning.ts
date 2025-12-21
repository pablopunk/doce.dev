import { logger } from "@/server/logger";
import { composeUp } from "@/server/docker/compose";
import { getProjectByIdIncludeDeleted, updateProjectStatus } from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { checkOpencodeReady, checkPreviewReady } from "@/server/projects/health";

const START_MAX_WAIT_MS = 30_000;

export async function handleDockerEnsureRunning(ctx: QueueJobContext): Promise<void> {
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
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  await updateProjectStatus(project.id, "error");
  logger.warn({ projectId: project.id }, "Timed out waiting for project readiness");
  throw new Error("timed out waiting for preview/opencode readiness");
}
