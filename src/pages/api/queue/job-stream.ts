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
	const KEEP_ALIVE_INTERVAL_MS = 15_000;
	let pollInterval: NodeJS.Timeout | null = null;
	let closeStream: (() => void) | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			const sendKeepAlive = () => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(": keep-alive\n\n"));
				} catch {
					// Stream closed
				}
			};

			const keepAliveTimer = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL_MS);
			closeStream = () => {
				if (isClosed) return;
				isClosed = true;
				if (pollInterval) {
					clearInterval(pollInterval);
					pollInterval = null;
				}
				clearInterval(keepAliveTimer);
				try {
					controller.close();
				} catch {
					// Already closed
				}
			};

			try {
				// Send initial data
				const data = {
					type: "init",
					job: initialJob,
					timestamp: new Date().toISOString(),
				};

				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
					);
				} catch (err) {
					if (err instanceof TypeError && err.message.includes("closed")) {
						return;
					}
					throw err;
				}

				pollInterval = setInterval(async () => {
					if (isClosed) {
						if (pollInterval) {
							clearInterval(pollInterval);
							pollInterval = null;
						}
						return;
					}

					try {
						const updatedJob = await getJobById(jobId);
						if (!updatedJob) {
							return;
						}

						const updateData = {
							type: "update",
							job: updatedJob,
							timestamp: new Date().toISOString(),
						};

						try {
							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify(updateData)}\n\n`),
							);
						} catch (err) {
							if (err instanceof TypeError && err.message.includes("closed")) {
								return;
							}
							throw err;
						}
					} catch (err) {
						console.error("Error polling queue job:", err);
					}
				}, 1000);

				request.signal?.addEventListener("abort", () => closeStream?.());
			} catch (err) {
				console.error("Error in job stream:", err);
				controller.error(err);
			}
		},

		cancel() {
			closeStream?.();
		},
	});

	return new Response(stream, { headers });
};
