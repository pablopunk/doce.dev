import { logger } from "@/server/logger";
import {
  getProjectByIdIncludeDeleted,
  markInitialPromptCompleted,
  updateProjectSetupPhase,
  updateProjectSetupPhaseAndError,
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
     // We need to check if the agent has finished processing by looking for an assistant message
     try {
       // Fetch messages from the session directly via HTTP
       const messagesUrl = `http://127.0.0.1:${project.opencodePort}/session/${sessionId}/message`;
       const messagesResponse = await fetch(messagesUrl, {
         method: "GET",
         signal: AbortSignal.timeout(5000),
       });

       if (!messagesResponse.ok) {
         throw new Error(`Failed to fetch messages: ${messagesResponse.status}`);
       }

       const messages = (await messagesResponse.json()) as unknown[];
       
       // Check if there's an assistant message (indicating the agent has processed the prompt)
       const hasAssistantMessage = messages.some((msg: unknown) => {
         const msgObj = msg as { info?: { role?: string } };
         return msgObj.info?.role === "assistant";
       });

       if (hasAssistantMessage) {
         // Agent has processed the prompt
         logger.info({ projectId: project.id, sessionId, elapsed, messageCount: messages.length }, "Agent has responded, bootstrap complete");
         await markInitialPromptCompleted(project.id);
         await updateProjectSetupPhase(project.id, "completed");
         return;
       }

       logger.debug(
         { projectId: project.id, sessionId, elapsed, messageCount: messages.length },
         "Agent hasn't responded yet, rescheduling"
       );

     } catch (error) {
       // If we can't check messages, log and reschedule
       logger.warn(
         { projectId: project.id, sessionId, error, elapsed },
         "Failed to check session messages, rescheduling"
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
