import { logger } from "@/server/logger";
import {
  getProjectByIdIncludeDeleted,
  markInitialPromptCompleted,
} from "@/server/projects/projects.model";
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
       return;
     }

     // Re-fetch project to check if event stream has already marked it complete
     // The event.ts handler detects session.status.idle events and marks completion
     // This job is a backup safety net in case the event stream fails
     const currentProject = await getProjectByIdIncludeDeleted(project.id);
     if (!currentProject) {
       throw new Error("Project not found");
     }

     if (currentProject.initialPromptCompleted) {
       logger.debug(
         { projectId: project.id, sessionId, elapsed },
         "Event stream detected idle status, marking complete"
       );
       return;
     }

     logger.debug(
       { projectId: project.id, sessionId, elapsed },
       "Waiting for event stream to detect session.status.idle, rescheduling"
     );

     // Not marked complete yet - reschedule and wait for event stream detection
     ctx.reschedule(POLL_DELAY_MS);
   } catch (error) {
     // Don't catch reschedule errors - those should propagate
     if (error instanceof RescheduleError) {
       throw error;
     }
     throw error;
   }
 }
