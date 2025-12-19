import { logger } from "@/server/logger";
import { getProjectByIdIncludeDeleted, updateBootstrapSessionId, updateProjectSetupPhase, updateProjectSetupPhaseAndError } from "@/server/projects/projects.model";
import { createOpencodeClient } from "@/server/opencode/client";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { enqueueOpencodeSendInitialPrompt } from "../enqueue";

export async function handleOpencodeSessionCreate(ctx: QueueJobContext): Promise<void> {
  const payload = parsePayload("opencode.sessionCreate", ctx.job.payloadJson);

  const project = await getProjectByIdIncludeDeleted(payload.projectId);
  if (!project) {
    logger.warn({ projectId: payload.projectId }, "Project not found for opencode.sessionCreate");
    return;
  }

  if (project.status === "deleting") {
    logger.info({ projectId: project.id }, "Skipping opencode.sessionCreate for deleting project");
    return;
  }

  // If already sent, skip
  if (project.initialPromptSent) {
    logger.info({ projectId: project.id }, "Initial prompt already sent, skipping session create");
    return;
  }

  try {
    await updateProjectSetupPhase(project.id, "initializing_agent");

    await ctx.throwIfCancelRequested();

    // Create opencode client
    const client = createOpencodeClient(project.opencodePort);

    // Create a new session
    const sessionResponse = await client.session.create();
    const sessionData = (sessionResponse as unknown as { data?: { id: string }; id?: string });
    const sessionId = sessionData.data?.id ?? sessionData.id;
    
    if (!sessionId) {
      throw new Error("Failed to create session: no session ID returned");
    }

    logger.info({ projectId: project.id, sessionId }, "Created opencode session");

    // Store the session ID in the project
    await updateBootstrapSessionId(project.id, sessionId);

    await ctx.throwIfCancelRequested();

    // Enqueue next step: send initial prompt
    await enqueueOpencodeSendInitialPrompt({ projectId: project.id });
    logger.debug({ projectId: project.id }, "Enqueued opencode.sendInitialPrompt");
   } catch (error) {
     const errorMsg = error instanceof Error ? error.message : String(error);
     await updateProjectSetupPhaseAndError(project.id, "failed", errorMsg);
     throw error;
   }
}
