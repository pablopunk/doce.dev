import { logger } from "@/server/logger";
import {
  getProjectByIdIncludeDeleted,
  markInitialPromptCompleted,
  updateProjectSetupPhase,
  updateProjectSetupPhaseAndError,
} from "@/server/projects/projects.model";
import { createOpencodeClient } from "@/server/opencode/client";
import type { QueueJobContext } from "../queue.worker";
import { RescheduleError } from "../queue.worker";
import { parsePayload } from "../types";

const WAIT_TIMEOUT_MS = 600_000; // 10 minutes max wait (LLM can take a while)
const POLL_DELAY_MS = 2_000; // 2 seconds between polls

export async function handleOpencodeWaitIdle(ctx: QueueJobContext): Promise<void> {
  const payload = parsePayload("opencode.waitIdle", ctx.job.payloadJson);

  const project = await getProjectByIdIncludeDeleted(payload.projectId);
  if (!project) {
    logger.warn({ projectId: payload.projectId }, "Project not found for opencode.waitIdle");
    return;
  }

  if (project.status === "deleting") {
    logger.info({ projectId: project.id }, "Skipping opencode.waitIdle for deleting project");
    return;
  }

  // If already completed, skip
  if (project.initialPromptCompleted) {
    logger.info({ projectId: project.id }, "Initial prompt already completed, skipping");
    return;
  }

  try {
    await updateProjectSetupPhase(project.id, "waiting_completion");

    const sessionId = project.bootstrapSessionId;
    if (!sessionId) {
      throw new Error("No bootstrap session ID found");
    }

    await ctx.throwIfCancelRequested();

    // Check if we've timed out
    const elapsed = Date.now() - payload.startedAt;
    if (elapsed > WAIT_TIMEOUT_MS) {
      // Don't fail - just mark as completed anyway so the user can use the project
      logger.warn({ projectId: project.id, elapsed }, "Timed out waiting for idle, marking complete anyway");
      await markInitialPromptCompleted(project.id);
      await updateProjectSetupPhase(project.id, "completed");
      return;
    }

    // Check session status via the opencode API
    // We need to check if the session is idle
    try {
      const client = createOpencodeClient(project.opencodePort);
      
      // Get the list of sessions and find ours
      const sessionsResponse = await client.session.list();
      const responseData = sessionsResponse as unknown as { data?: { id: string }[]; sessions?: { id: string }[] };
      const sessions = responseData.data ?? responseData.sessions ?? [];
      
      // Find our session
      const session = sessions.find((s: { id?: string }) => s.id === sessionId);
      
      if (!session) {
        // Session doesn't exist anymore? Mark as completed
        logger.warn({ projectId: project.id, sessionId }, "Bootstrap session not found, marking complete");
        await markInitialPromptCompleted(project.id);
        await updateProjectSetupPhase(project.id, "completed");
        return;
      }

      // Check if session is idle
      // The session object should have a status field
      const status = (session as { status?: { type?: string } }).status?.type;
      
      if (status === "idle") {
        logger.info({ projectId: project.id, sessionId, elapsed }, "Session is idle, bootstrap complete");
        await markInitialPromptCompleted(project.id);
        await updateProjectSetupPhase(project.id, "completed");
        return;
      }

      logger.debug(
        { projectId: project.id, sessionId, status, elapsed },
        "Session not idle yet, rescheduling"
      );

    } catch (error) {
      // If we can't check status, log and reschedule
      logger.warn(
        { projectId: project.id, sessionId, error, elapsed },
        "Failed to check session status, rescheduling"
      );
    }

    // Not idle yet - reschedule
    ctx.reschedule(POLL_DELAY_MS);
   } catch (error) {
     // Don't catch reschedule errors - those should propagate
     if (error instanceof RescheduleError) {
       throw error;
     }
     const errorMsg = error instanceof Error ? error.message : String(error);
     await updateProjectSetupPhaseAndError(project.id, "failed", errorMsg);
     throw error;
   }
}
