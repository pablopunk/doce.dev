import type { APIRoute } from "astro";
import { listJobs, isQueuePaused, getConcurrency } from "@/server/queue/queue.model";
import type { QueueJob } from "@/server/db/schema";

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse query parameters for filtering
  const url = new URL(request.url);
  const stateParam = url.searchParams.get("state") ?? "";
  const typeParam = url.searchParams.get("type") ?? "";
  const projectIdParam = url.searchParams.get("projectId") ?? "";
  const qParam = url.searchParams.get("q") ?? "";

  const allowedStates = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
  const state = allowedStates.includes(stateParam as (typeof allowedStates)[number])
    ? (stateParam as QueueJob["state"])
    : undefined;

  const allowedTypes = [
    "project.create",
    "project.delete",
    "projects.deleteAllForUser",
    "docker.composeUp",
    "docker.waitReady",
    "docker.ensureRunning",
    "docker.stop",
    "opencode.sessionCreate",
    "opencode.sendInitialPrompt",
    "opencode.waitIdle",
  ] as const;
  const type = allowedTypes.includes(typeParam as (typeof allowedTypes)[number])
    ? (typeParam as QueueJob["type"])
    : undefined;

  // SSE response with headers
  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const encoder = new TextEncoder();
  let isClosed = false;
  let pollInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
       try {
         // Send initial data
         const jobs = await listJobs({
           state,
           type,
           projectId: projectIdParam || undefined,
           q: qParam || undefined,
           limit: 100,
         } as any);
         const paused = await isQueuePaused();
         const concurrency = await getConcurrency();

         const data = {
           type: "init",
           jobs,
           paused,
           concurrency,
           timestamp: new Date().toISOString(),
         };

         controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

        // Poll for updates every 2 seconds
        pollInterval = setInterval(async () => {
          if (isClosed) {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
            return;
          }

           try {
             const updatedJobs = await listJobs({
               state,
               type,
               projectId: projectIdParam || undefined,
               q: qParam || undefined,
               limit: 100,
             } as any);
             const updatedPaused = await isQueuePaused();
             const updatedConcurrency = await getConcurrency();

             const updateData = {
               type: "update",
               jobs: updatedJobs,
               paused: updatedPaused,
               concurrency: updatedConcurrency,
               timestamp: new Date().toISOString(),
             };

             if (!isClosed) {
               controller.enqueue(encoder.encode(`data: ${JSON.stringify(updateData)}\n\n`));
             }
          } catch (err) {
            console.error("Error polling queue jobs:", err);
          }
        }, 2000); // Poll every 2 seconds

        // Handle client disconnect
        request.signal?.addEventListener("abort", () => {
          isClosed = true;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
          controller.close();
        });
      } catch (err) {
        console.error("Error in queue jobs stream:", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers });
};
