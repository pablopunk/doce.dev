import type { APIRoute } from "astro";
import { getJobById } from "@/server/queue/queue.model";

export const GET: APIRoute = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return new Response("Job ID required", { status: 400 });
  }

  // Verify job exists
  const initialJob = await getJobById(jobId);
  if (!initialJob) {
    return new Response("Job not found", { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
         // Send initial data
         const data = {
           type: "init",
           job: initialJob,
           timestamp: new Date().toISOString(),
         };

         try {
           controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
         } catch (err) {
           // Controller closed unexpectedly during initial send
           if (err instanceof TypeError && err.message.includes("closed")) {
             return;
           }
           throw err;
         }

        // Poll for updates every 1 second
        const pollInterval = setInterval(async () => {
          if (isClosed) {
            clearInterval(pollInterval);
            return;
          }

          try {
            const updatedJob = await getJobById(jobId);
            if (!updatedJob) {
              return; // Job deleted
            }

             const updateData = {
               type: "update",
               job: updatedJob,
               timestamp: new Date().toISOString(),
             };

             try {
               controller.enqueue(encoder.encode(`data: ${JSON.stringify(updateData)}\n\n`));
             } catch (err) {
               // Controller already closed - expected on disconnect
               if (err instanceof TypeError && err.message.includes("closed")) {
                 return;
               }
               throw err;
             }
          } catch (err) {
            console.error("Error polling queue job:", err);
          }
        }, 1000); // Poll every 1 second for more responsive detail view

        // Handle client disconnect
        request.signal?.addEventListener("abort", () => {
          isClosed = true;
          clearInterval(pollInterval);
          controller.close();
        });
      } catch (err) {
        console.error("Error in job stream:", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, { headers });
};
