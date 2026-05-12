import type { APIRoute } from "astro";
import { requireAuth } from "@/server/auth/requireAuth";
import { getContainerStats } from "@/server/monitor/stats";

const KEEP_ALIVE_INTERVAL_MS = 30_000;
const POLL_INTERVAL_MS = 2_000;

export const GET: APIRoute = async ({ cookies }) => {
	const auth = await requireAuth(cookies);
	if (!auth.ok) return auth.response;

	const encoder = new TextEncoder();
	let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let isClosed = false;

	const stream = new ReadableStream({
		async start(controller) {
			const sendSnapshot = async () => {
				if (isClosed) return;
				try {
					const containers = await getContainerStats();
					const payload = {
						containers,
						timestamp: new Date().toISOString(),
					};
					controller.enqueue(
						encoder.encode(
							`event: snapshot\ndata: ${JSON.stringify(payload)}\n\n`,
						),
					);
				} catch {
					// Ignore errors on closed stream
				}
			};

			const sendKeepAlive = () => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(": keep-alive\n\n"));
				} catch {}
			};

			// Send initial snapshot immediately
			await sendSnapshot();

			pollTimer = setInterval(() => {
				void sendSnapshot();
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
