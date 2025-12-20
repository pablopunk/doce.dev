import { logger } from "@/server/logger";
import {
  getProjectByIdIncludeDeleted,
  markInitialPromptSent,
} from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { enqueueOpencodeWaitIdle } from "../enqueue";

export async function handleOpencodeSendInitialPrompt(ctx: QueueJobContext): Promise<void> {
  const payload = parsePayload("opencode.sendInitialPrompt", ctx.job.payloadJson);

  const project = await getProjectByIdIncludeDeleted(payload.projectId);
  if (!project) {
    logger.warn({ projectId: payload.projectId }, "Project not found for opencode.sendInitialPrompt");
    return;
  }

  if (project.status === "deleting") {
    logger.info({ projectId: project.id }, "Skipping opencode.sendInitialPrompt for deleting project");
    return;
  }

  // If already sent, skip
  if (project.initialPromptSent) {
    logger.info({ projectId: project.id }, "Initial prompt already sent, skipping");
    return;
  }

    try {
      const sessionId = project.bootstrapSessionId;
    if (!sessionId) {
      throw new Error("No bootstrap session ID found - session not created?");
    }

    await ctx.throwIfCancelRequested();

    // Send the initial prompt via HTTP (prompt_async)
    const url = `http://127.0.0.1:${project.opencodePort}/session/${sessionId}/prompt_async`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parts: [{ type: "text", text: project.prompt }],
      }),
    });

    // prompt_async returns 204 No Content on success
    if (!response.ok && response.status !== 204) {
      const text = await response.text().catch(() => "");
      throw new Error(`Failed to send initial prompt: ${response.status} ${text.slice(0, 200)}`);
    }

    logger.info({ projectId: project.id, sessionId }, "Sent initial prompt");

    // Mark initial prompt as sent
    await markInitialPromptSent(project.id);

    await ctx.throwIfCancelRequested();

    // Enqueue next step: wait for idle
    await enqueueOpencodeWaitIdle({
      projectId: project.id,
      startedAt: Date.now(),
    });
    logger.debug({ projectId: project.id }, "Enqueued opencode.waitIdle");
    } catch (error) {
      throw error;
    }
}
