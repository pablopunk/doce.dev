import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import {
  getProjectById,
  isProjectOwnedByUser,
  markInitialPromptCompleted,
} from "@/server/projects/projects.model";
import {
  normalizeEvent,
  parseSSEData,
  createNormalizationState,
} from "@/server/opencode/normalize";
import { logger } from "@/server/logger";
import { db } from "@/server/db/client";
import { queueJobs } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

const SESSION_COOKIE_NAME = "doce_session";
const KEEP_ALIVE_INTERVAL_MS = 15_000;
const CONNECT_TIMEOUT_MS = 10_000;

/**
 * Update the opencode.waitIdle job's lastToolActivityAt timestamp.
 * Called when tool events are detected to help track agent activity.
 */
async function updateWaitIdleJobActivityTime(projectId: string): Promise<void> {
  try {
    // Find the most recent opencode.waitIdle job for this project
    const waitIdleJob = await db
      .select()
      .from(queueJobs)
      .where(
        and(
          eq(queueJobs.projectId, projectId),
          eq(queueJobs.type, "opencode.waitIdle")
        )
      )
      .orderBy(queueJobs.createdAt)
      .limit(1);

    if (!waitIdleJob[0]) {
      return; // No waitIdle job found
    }

    const job = waitIdleJob[0];
    const payload = JSON.parse(job.payloadJson) as Record<string, unknown>;

    // Update lastToolActivityAt to current time
    payload.lastToolActivityAt = Date.now();

    // Update the job payload in the database
    await db
      .update(queueJobs)
      .set({
        payloadJson: JSON.stringify(payload),
        updatedAt: new Date(),
      })
      .where(eq(queueJobs.id, job.id));

    logger.debug(
      { projectId, jobId: job.id },
      "Updated waitIdle job activity timestamp"
    );
  } catch (error) {
    logger.warn(
      { error, projectId },
      "Failed to update waitIdle job activity timestamp"
    );
    // Don't throw - this is not critical, event stream should still work
  }
}

/**
 * Check if an event represents tool activity.
 */
function isToolActivityEvent(eventType: string): boolean {
  return (
    eventType === "tool.execute" ||
    eventType === "tool.result" ||
    eventType === "chat.tool.start" ||
    eventType === "chat.tool.finish" ||
    (eventType === "message.part.updated") // Tool updates come through here
  );
}

export const GET: APIRoute = async ({ params, cookies }) => {
  // Validate session
  const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  const session = await validateSession(sessionToken);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const projectId = params.id;
  if (!projectId) {
    return new Response("Project ID required", { status: 400 });
  }

  // Verify project ownership
  const isOwner = await isProjectOwnedByUser(projectId, session.user.id);
  if (!isOwner) {
    return new Response("Not found", { status: 404 });
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return new Response("Not found", { status: 404 });
  }

  // Connect to upstream opencode SSE
  const upstreamUrl = `http://127.0.0.1:${project.opencodePort}/event`;

  let upstreamResponse: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

    upstreamResponse = await fetch(upstreamUrl, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!upstreamResponse.ok) {
      return new Response(`Upstream error: ${upstreamResponse.status}`, {
        status: 502,
      });
    }

    if (!upstreamResponse.body) {
      return new Response("No response body", { status: 502 });
    }
  } catch (error) {
    logger.warn({ error, projectId }, "Failed to connect to opencode SSE");
    return new Response("Failed to connect to opencode", { status: 502 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const state = createNormalizationState();
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let isClosed = false;
  let dataBuffer = "";

  // Track if we've already marked initial prompt as completed for this connection
  let hasMarkedInitialPromptCompleted = project.initialPromptCompleted;

  /**
   * Check if the session has become idle and mark initial prompt as completed if needed.
   * This is called server-side so it works even if client disconnects.
   */
  const checkInitialPromptCompletion = async (
    parsed: { type: string; properties?: Record<string, unknown> }
  ) => {
    // Check session.status events for idle status
    // The event format is: {"type":"session.status","properties":{"sessionID":"...","status":{"type":"idle"}}}
    if (parsed.type !== "session.status") return;

    const statusObj = parsed.properties?.status as { type?: string } | undefined;
    const status = statusObj?.type;

    // Already marked as completed - no need to check again
    if (hasMarkedInitialPromptCompleted) return;

    // Session is idle = agent has finished responding
    if (status === "idle") {
      // Re-fetch project to get latest state (in case it was updated elsewhere)
      const currentProject = await getProjectById(projectId);
      if (!currentProject) return;

      // Only mark completed if initial prompt was sent but not yet completed
      if (currentProject.initialPromptSent && !currentProject.initialPromptCompleted) {
        logger.info({ projectId }, "Initial prompt completed - marking in database");
        await markInitialPromptCompleted(projectId);
        hasMarkedInitialPromptCompleted = true;
      }
    }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: object) => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: chat.event\ndata: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      };

      const sendKeepAlive = () => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`:keep-alive\n\n`));
        } catch {
          // Stream closed
        }
      };

      // Start keep-alive timer
      keepAliveTimer = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL_MS);

      // Read from upstream
      const reader = upstreamResponse.body!.getReader();

      try {
        while (!isClosed) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // Decode and process SSE data
          const chunk = decoder.decode(value, { stream: true });
          dataBuffer += chunk;

          // Process complete lines
          const lines = dataBuffer.split("\n");
          dataBuffer = lines.pop() ?? ""; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith(":")) {
              continue;
            }

            // Parse data lines
            if (trimmed.startsWith("data:")) {
              const data = trimmed.slice(5).trim();
              const parsed = parseSSEData(data);

               if (parsed) {
                 // Check for initial prompt completion (server-side detection)
                 checkInitialPromptCompletion(parsed).catch((error) => {
                   logger.error({ error, projectId }, "Error checking initial prompt completion");
                 });

                 // Track tool activity for stuck agent detection
                 if (isToolActivityEvent(parsed.type)) {
                   updateWaitIdleJobActivityTime(projectId).catch((error) => {
                     logger.debug({ error, projectId }, "Failed to update activity time");
                   });
                 }

                 const normalized = normalizeEvent(projectId, parsed, state);
                 sendEvent(normalized);
               }
            }
          }
        }
      } catch (error) {
        if (!isClosed) {
          logger.error({ error, projectId }, "Error reading upstream SSE");
        }
      } finally {
        reader.releaseLock();
        if (!isClosed) {
          controller.close();
        }
      }
    },

    cancel() {
      isClosed = true;
      if (keepAliveTimer) clearInterval(keepAliveTimer);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
};
