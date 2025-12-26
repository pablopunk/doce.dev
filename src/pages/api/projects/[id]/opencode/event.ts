import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import {
  getProjectById,
  isProjectOwnedByUser,
  markInitPromptCompleted,
  markUserPromptCompleted,
} from "@/server/projects/projects.model";
import {
  normalizeEvent,
  parseSSEData,
  createNormalizationState,
} from "@/server/opencode/normalize";
import { logger } from "@/server/logger";

const SESSION_COOKIE_NAME = "doce_session";
const KEEP_ALIVE_INTERVAL_MS = 15_000;
const CONNECT_TIMEOUT_MS = 10_000;

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

  // Track completion state for this connection using idle event counter
  // First idle = init prompt completed (AGENTS.md generation)
  // Second idle = user prompt completed (actual project work)
  let idleEventCount = 0;
  let hasMarkedInitPromptCompleted = project.initPromptCompleted;
  let hasMarkedUserPromptCompleted = project.userPromptCompleted;

   /**
    * Check if the session has become idle and mark prompts as completed.
    * Uses idle event counting: 1st idle = init prompt done, 2nd idle = user prompt done.
    * This is called server-side so it works even if client disconnects.
    */
   const checkPromptCompletion = async (
     parsed: { type: string; properties?: Record<string, unknown> },
     sendEvent: (event: object) => void
   ) => {
     // Check session.status events for idle status
     // The event format is: {"type":"session.status","properties":{"sessionID":"...","status":{"type":"idle"}}}
     if (parsed.type !== "session.status") return;

     const properties = parsed.properties as { status?: { type?: string } } | undefined;
     const status = properties?.status?.type;

     // Only process idle events
     if (status !== "idle") return;

     // Re-fetch project to get latest state (in case it was updated elsewhere)
     const currentProject = await getProjectById(projectId);
     if (!currentProject) return;

     // Don't count idle events if prompts haven't been sent yet
     if (!currentProject.initialPromptSent) return;

     // Increment idle counter
     idleEventCount++;

     logger.debug(
       { projectId, idleEventCount, hasMarkedInitPromptCompleted, hasMarkedUserPromptCompleted },
       "Received idle event"
     );

     // First idle event = init prompt completed (AGENTS.md generation finished)
     if (idleEventCount === 1 && !hasMarkedInitPromptCompleted) {
       logger.info({ projectId }, "Init prompt completed - marking in database");
       await markInitPromptCompleted(projectId);
       hasMarkedInitPromptCompleted = true;
       // Don't send setup.complete yet - still waiting for user prompt
     }

     // Second idle event = user prompt completed (actual project work finished)
     if (idleEventCount === 2 && !hasMarkedUserPromptCompleted) {
       logger.info({ projectId }, "User prompt completed - marking in database");
       await markUserPromptCompleted(projectId);
       hasMarkedUserPromptCompleted = true;
       
       // NOW both prompts are complete - send setup.complete event
       sendEvent({
         type: "setup.complete",
         payload: {},
       });
     }

     // Edge case: If we reconnected and both were already marked,
     // but the user prompt was still running, we might see more idle events.
     // In that case, if we haven't sent setup.complete yet and both are now done,
     // send it now.
     if (hasMarkedInitPromptCompleted && hasMarkedUserPromptCompleted) {
       // Both already marked - nothing more to do
       return;
     }
   };

   // Callback to send events from within the stream
   let sendEventFn: ((event: object) => void) | null = null;

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

       // Store sendEvent for use in checkInitialPromptCompletion
       sendEventFn = sendEvent;

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
                  // Check for prompt completion (server-side detection)
                  // Cast to simple shape for prompt completion check
                  const eventForCheck = parsed as { type: string; properties?: Record<string, unknown> };
                  if (sendEventFn) {
                    checkPromptCompletion(eventForCheck, sendEventFn).catch((error: unknown) => {
                      logger.error({ error, projectId }, "Error checking prompt completion");
                    });
                  }

                  const normalized = normalizeEvent(projectId, parsed, state);
                  if (normalized) {
                    sendEvent(normalized);
                  }
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
