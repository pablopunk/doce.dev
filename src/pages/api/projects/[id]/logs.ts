import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { getProjectById, isProjectOwnedByUser } from "@/server/projects/projects.model";
import { readLogTail, readLogFromOffset } from "@/server/docker/logs";
import * as path from "node:path";

const SESSION_COOKIE_NAME = "doce_session";
const KEEP_ALIVE_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 1_000;

export const GET: APIRoute = async ({ params, url, cookies }) => {
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

  // Get offset from query params
  const offsetParam = url.searchParams.get("offset");
  const requestedOffset = offsetParam ? parseInt(offsetParam, 10) : null;

  const logsDir = path.join(project.pathOnDisk, "logs");

  // Create a streaming response
  const encoder = new TextEncoder();
  let lastOffset = requestedOffset ?? 0;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`event: log.chunk\ndata: ${JSON.stringify(data)}\n\n`));
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

      // Initial read
      if (requestedOffset === null) {
        // No offset - read tail
        const { content, offset, truncated } = await readLogTail(logsDir);
        lastOffset = offset;
        sendEvent({
          projectId,
          offset: 0,
          nextOffset: offset,
          text: content,
          truncated,
        });
      } else if (requestedOffset >= 0) {
        // Read from offset
        const { content, nextOffset } = await readLogFromOffset(logsDir, requestedOffset);
        lastOffset = nextOffset;
        if (content) {
          sendEvent({
            projectId,
            offset: requestedOffset,
            nextOffset,
            text: content,
            truncated: false,
          });
        }
      }

      // Start polling for new content
      pollTimer = setInterval(async () => {
        if (isClosed) return;

        try {
          const { content, nextOffset } = await readLogFromOffset(logsDir, lastOffset);
          if (content) {
            sendEvent({
              projectId,
              offset: lastOffset,
              nextOffset,
              text: content,
              truncated: false,
            });
            lastOffset = nextOffset;
          }
        } catch {
          // Ignore read errors
        }
      }, POLL_INTERVAL_MS);

      // Start keep-alive timer
      keepAliveTimer = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL_MS);
    },

    cancel() {
      isClosed = true;
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (pollTimer) clearInterval(pollTimer);
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
