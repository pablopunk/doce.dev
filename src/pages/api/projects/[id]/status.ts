import type { APIRoute } from "astro";
import {
	subscribePreviewStatus,
	getLastPreviewStatus,
} from "@/lib/preview-status-bus";

export const GET: APIRoute = async ({ params }) => {
	const projectId = params.id;
	if (!projectId) return new Response("Project ID required", { status: 400 });

	const encoder = new TextEncoder();
	let keepalive: NodeJS.Timeout | null = null;
	let unsubscribeGlobal: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			// Send last known status if any
			const last = getLastPreviewStatus(projectId);
			const initial = last ?? {
				status: "not-created",
				previewUrl: null,
				timestamp: new Date().toISOString(),
			};
			controller.enqueue(
				encoder.encode(`data: ${JSON.stringify(initial)}\n\n`),
			);

			// Subscribe to updates
			const unsubscribe = subscribePreviewStatus(projectId, (payload) => {
				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
					);
				} catch (e) {
					// ignore
				}
			});

			// keepalive comments
			keepalive = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": keepalive\n\n"));
				} catch (e) {
					// ignore
				}
			}, 15000);

			controller.enqueue(
				encoder.encode(`data: ${JSON.stringify({ message: "connected" })}\n\n`),
			);

			// Track unsubscribe for use in cancel()
			unsubscribeGlobal = unsubscribe;
		},
		cancel() {
			if (keepalive) clearInterval(keepalive);
			if (unsubscribeGlobal) unsubscribeGlobal();
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
