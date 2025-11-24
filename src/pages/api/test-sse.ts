import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			const sendEvent = (data: any) => {
				const message = `data: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			sendEvent({ type: "test", message: "SSE working!" });

			const interval = setInterval(() => {
				sendEvent({ type: "ping", time: new Date().toISOString() });
			}, 1000);

			setTimeout(() => {
				clearInterval(interval);
				controller.close();
			}, 5000);
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
