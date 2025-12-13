import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { getProjectById, isProjectOwnedByUser } from "@/server/projects/projects.model";
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
