import { logger } from "@/server/logger";
import { getProjectByIdIncludeDeleted, updateProjectStatus, updateProjectSetupPhase } from "@/server/projects/projects.model";
import { checkPreviewReady, checkOpencodeReady } from "@/server/projects/health";
import type { QueueJobContext } from "../queue.worker";
import { RescheduleError } from "../queue.worker";
import { parsePayload } from "../types";
import { enqueueOpencodeSessionCreate } from "../enqueue";

const WAIT_TIMEOUT_MS = 300_000; // 5 minutes max wait
const POLL_DELAY_MS = 1_000; // 1 second between polls

export async function handleDockerWaitReady(ctx: QueueJobContext): Promise<void> {
  const payload = parsePayload("docker.waitReady", ctx.job.payloadJson);

  const project = await getProjectByIdIncludeDeleted(payload.projectId);
  if (!project) {
    logger.warn({ projectId: payload.projectId }, "Project not found for docker.waitReady");
    return;
  }

  if (project.status === "deleting") {
    logger.info({ projectId: project.id }, "Skipping docker.waitReady for deleting project");
    return;
  }

  try {
    await ctx.throwIfCancelRequested();

    // Check if we've timed out
    const elapsed = Date.now() - payload.startedAt;
    if (elapsed > WAIT_TIMEOUT_MS) {
      await updateProjectStatus(project.id, "error");
      await updateProjectSetupPhase(project.id, "failed");
      throw new Error(`Timed out waiting for services to be ready (${elapsed}ms)`);
    }

    // Check if services are ready
    const [previewReady, opencodeReady] = await Promise.all([
      checkPreviewReady(project.devPort),
      checkOpencodeReady(project.opencodePort),
    ]);

    if (previewReady && opencodeReady) {
      await updateProjectStatus(project.id, "running");
      logger.info({ projectId: project.id, elapsed }, "Services are ready");

      // Only enqueue bootstrap jobs if initial prompt hasn't been sent yet
      if (!project.initialPromptSent) {
        await enqueueOpencodeSessionCreate({ projectId: project.id });
        logger.debug({ projectId: project.id }, "Enqueued opencode.sessionCreate");
      } else {
        // If already sent, mark setup as complete
        await updateProjectSetupPhase(project.id, "completed");
      }

      return;
    }

    // Not ready yet - reschedule
    logger.debug(
      { projectId: project.id, elapsed, previewReady, opencodeReady },
      "Services not ready, rescheduling"
    );

    ctx.reschedule(POLL_DELAY_MS);
  } catch (error) {
    // Don't catch reschedule errors - those should propagate
    if (error instanceof RescheduleError) {
      throw error;
    }
    await updateProjectSetupPhase(project.id, "failed");
    throw error;
  }
}
