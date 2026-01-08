import * as path from "node:path";
import type { APIRoute } from "astro";
import { readLogFromOffset, readLogTail } from "@/server/docker/logs";
import { requireAuthenticatedProjectAccess } from "@/server/auth/validators";

const KEEP_ALIVE_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 1_000;

export const GET: APIRoute = async ({ params, url, cookies }) => {
	const authResult = await requireAuthenticatedProjectAccess(
		cookies,
		params.id ?? "",
	);
	if (!authResult.success) {
		return authResult.response;
	}

	const { project } = authResult;

	// Get offset from query params
	const offsetParam = url.searchParams.get("offset");
	const requestedOffset = offsetParam ? parseInt(offsetParam, 10) : null;

	const logsDir = path.join(project.path, "logs");

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
					controller.enqueue(
						encoder.encode(
							`event: log.chunk\ndata: ${JSON.stringify(data)}\n\n`,
						),
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
				const { content, nextOffset } = await readLogFromOffset(
					logsDir,
					requestedOffset,
				);
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
					const { content, nextOffset } = await readLogFromOffset(
						logsDir,
						lastOffset,
					);
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
			Connection: "keep-alive",
		},
	});
};
