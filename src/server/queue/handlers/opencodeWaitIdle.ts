import { logger } from "@/server/logger";
import {
  getProjectByIdIncludeDeleted,
  markInitialPromptCompleted,
} from "@/server/projects/projects.model";
import { checkSessionStatusDirectly } from "@/server/opencode/client";
import type { QueueJobContext } from "../queue.worker";
import { RescheduleError } from "../queue.worker";
import { parsePayload } from "../types";

const WAIT_TIMEOUT_MS = 600_000; // 10 minutes max wait (LLM can take a while)
const POLL_DELAY_MS = 2_000; // 2 seconds between polls
const STUCK_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes of no activity = potentially stuck
const STUCK_WARNING_DEBOUNCE_MS = 60 * 1000; // Only warn once per minute to avoid spam

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

      // PART 1: Try direct session status polling (robust fallback to event stream)
      // This provides an independent check that doesn't rely on event stream health
      const isIdleDirectly = await checkSessionStatusDirectly(
        sessionId,
        project.opencodePort
      );
      if (isIdleDirectly) {
        logger.info(
          { projectId: project.id, sessionId, elapsed },
          "Session detected as idle via direct polling, marking complete"
        );
        await markInitialPromptCompleted(project.id);
        return;
      }

      // PART 2: Detect stuck agents (monitoring/observability)
      // Track tool activity to distinguish between "slow but working" vs "genuinely stuck"
      const lastActivity = payload.lastToolActivityAt ?? payload.startedAt;
      const noActivityFor = Date.now() - lastActivity;

      if (noActivityFor > STUCK_THRESHOLD_MS) {
        const lastWarning = payload.stuckWarningSentAt ?? 0;
        const timeSinceLastWarning = Date.now() - lastWarning;

        // Only warn once per minute to avoid log spam
        if (timeSinceLastWarning > STUCK_WARNING_DEBOUNCE_MS) {
          logger.warn(
            {
              projectId: project.id,
              sessionId,
              elapsed,
              noActivityFor,
              lastToolActivityAt: payload.lastToolActivityAt,
            },
            "Agent appears stuck - no tool activity for 2+ minutes"
          );

          // Update payload to track that we sent a warning (for debouncing)
          payload.stuckWarningSentAt = Date.now();
        }
      }

      logger.debug(
        { projectId: project.id, sessionId, elapsed, noActivityFor: Date.now() - lastActivity },
        "Waiting for session idle status, rescheduling"
      );

      // Reschedule with updated payload (includes latest lastToolActivityAt from event stream)
      ctx.reschedule(POLL_DELAY_MS);
    } catch (error) {
      // Don't catch reschedule errors - those should propagate
      if (error instanceof RescheduleError) {
        throw error;
      }
      throw error;
    }
 }
