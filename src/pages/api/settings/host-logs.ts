import type { APIRoute } from "astro";
import { requireAuth } from "@/server/auth/requireAuth";
import { readHostLogFromOffset, readHostLogTail } from "@/server/settings/logs";

const KEEP_ALIVE_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 1_000;

export const GET: APIRoute = async ({ url, cookies }) => {
	const auth = await requireAuth(cookies);
	if (!auth.ok) return auth.response;

	const offsetParam = url.searchParams.get("offset");
	const requestedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : null;

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
				} catch {}
			};

			const sendKeepAlive = () => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(": keep-alive\n\n"));
				} catch {}
			};

			if (requestedOffset === null) {
				const { content, offset, truncated } = await readHostLogTail();
				lastOffset = offset;
				sendEvent({ offset: 0, nextOffset: offset, text: content, truncated });
			} else if (requestedOffset >= 0) {
				const { content, nextOffset } =
					await readHostLogFromOffset(requestedOffset);
				lastOffset = nextOffset;
				if (content) {
					sendEvent({
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
					const { content, nextOffset } =
						await readHostLogFromOffset(lastOffset);
					if (content) {
						sendEvent({
							offset: lastOffset,
							nextOffset,
							text: content,
							truncated: false,
						});
						lastOffset = nextOffset;
					}
				} catch {}
			}, POLL_INTERVAL_MS);

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
