import type { APIRoute } from "astro";
import { logger } from "@/server/logger";
import { canUserAccessQueueJob } from "@/server/queue/access";
import { readJobLogFromOffset, readJobLogTail } from "@/server/queue/job-logs";
import { getJobById } from "@/server/queue/queue.model";

const KEEP_ALIVE_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 1_000;

export const GET: APIRoute = async ({ request, url, locals }) => {
	const user = locals.user;
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const jobId = url.searchParams.get("jobId");
	if (!jobId) {
		return new Response("Job ID required", { status: 400 });
	}

	const job = await getJobById(jobId);
	if (!job) {
		return new Response("Job not found", { status: 404 });
	}

	const canAccessJob = await canUserAccessQueueJob(user.id, job);
	if (!canAccessJob) {
		return new Response("Not found", { status: 404 });
	}

	const offsetParam = url.searchParams.get("offset");
	const requestedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : null;
	if (requestedOffset !== null && Number.isNaN(requestedOffset)) {
		return new Response("Invalid offset", { status: 400 });
	}

	const encoder = new TextEncoder();
	let isClosed = false;
	let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let lastOffset = requestedOffset ?? 0;

	const stream = new ReadableStream({
		async start(controller) {
			const sendEvent = (data: object) => {
				if (isClosed) return;
				try {
					controller.enqueue(
						encoder.encode(
							`event: log.chunk\ndata: ${JSON.stringify(data)}\n\n`,
						),
					);
				} catch {
					isClosed = true;
				}
			};

			const sendKeepAlive = () => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(": keep-alive\n\n"));
				} catch {
					isClosed = true;
				}
			};

			const cleanup = () => {
				isClosed = true;
				if (keepAliveTimer) clearInterval(keepAliveTimer);
				if (pollTimer) clearInterval(pollTimer);
			};

			try {
				if (requestedOffset === null) {
					const { content, offset, truncated } = await readJobLogTail(jobId);
					lastOffset = offset;
					sendEvent({
						jobId,
						offset: 0,
						nextOffset: offset,
						text: content,
						truncated,
					});
				} else if (requestedOffset >= 0) {
					const { content, nextOffset } = await readJobLogFromOffset(
						jobId,
						requestedOffset,
					);
					lastOffset = nextOffset;
					if (content) {
						sendEvent({
							jobId,
							offset: requestedOffset,
							nextOffset,
							text: content,
							truncated: false,
						});
					}
				}

				pollTimer = setInterval(async () => {
					if (isClosed) return;
					try {
						const { content, nextOffset } = await readJobLogFromOffset(
							jobId,
							lastOffset,
						);
						if (!content) return;

						sendEvent({
							jobId,
							offset: lastOffset,
							nextOffset,
							text: content,
							truncated: false,
						});
						lastOffset = nextOffset;
					} catch (error) {
						logger.warn(
							{ error, jobId },
							"Failed reading job log stream chunk",
						);
					}
				}, POLL_INTERVAL_MS);

				keepAliveTimer = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL_MS);

				request.signal?.addEventListener("abort", () => {
					cleanup();
					try {
						controller.close();
					} catch (error) {
						logger.debug(
							{ error, jobId },
							"Queue job logs stream already closed",
						);
					}
				});
			} catch (error) {
				cleanup();
				logger.error({ error, jobId }, "Error in queue job logs stream");
				controller.error(error);
			}
		},

		cancel() {
			isClosed = true;
			if (keepAliveTimer) clearInterval(keepAliveTimer);
			if (pollTimer) clearInterval(pollTimer);
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
};
