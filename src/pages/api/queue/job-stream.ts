import type { APIRoute } from "astro";
import { logger } from "@/server/logger";
import { canUserAccessQueueJob } from "@/server/queue/access";
import { subscribeQueueEvents } from "@/server/queue/events";
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

	const initialJob = await getJobById(jobId);
	if (!initialJob) {
		return new Response("Job not found", { status: 404 });
	}

	const canAccessJob = await canUserAccessQueueJob(user.id, initialJob);
	if (!canAccessJob) {
		return new Response("Not found", { status: 404 });
	}

	const encoder = new TextEncoder();
	const headers = new Headers({
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
		"X-Accel-Buffering": "no",
	});

	const stream = new ReadableStream({
		start(controller) {
			let isClosed = false;
			const send = async (type: "init" | "update") => {
				const job = await getJobById(jobId);
				if (!job || isClosed) return;
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ type, job, timestamp: new Date().toISOString() })}\n\n`,
					),
				);
			};

			const keepAliveTimer = setInterval(() => {
				if (isClosed) return;
				controller.enqueue(encoder.encode(": keep-alive\n\n"));
			}, 15_000);

			void send("init");

			const unsubscribe = subscribeQueueEvents((event) => {
				if (event.jobId !== jobId) return;
				void send("update").catch((error) => {
					logger.error({ error, jobId }, "Failed to push queue job update");
				});
			});

			const cleanup = () => {
				if (isClosed) return;
				isClosed = true;
				unsubscribe();
				clearInterval(keepAliveTimer);
				try {
					controller.close();
				} catch {}
			};

			request.signal.addEventListener("abort", cleanup);
		},
	});

	return new Response(stream, { headers });
};
