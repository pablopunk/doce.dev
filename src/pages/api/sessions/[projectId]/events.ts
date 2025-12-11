import type { APIRoute } from "astro";
import { Conversation } from "@/domain/conversations/models/conversation";
import { createLogger } from "@/lib/logger";
import { getProjectOpencodeClient } from "@/lib/opencode";

const logger = createLogger("session-events");

export const maxDuration = 300;

export const GET: APIRoute = async ({ params }) => {
	const projectId = params.projectId;

	if (!projectId) {
		logger.error("No project ID provided");
		return new Response("Project ID required", { status: 400 });
	}

	logger.info(`SSE request for project ${projectId}`);

	let opencodeClient;
	try {
		opencodeClient = await getProjectOpencodeClient(projectId);
	} catch (error) {
		logger.error(
			"Failed to connect to project OpenCode server",
			error as Error,
		);
		return new Response("Project preview is not running", { status: 503 });
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			let closed = false;

			const sendEvent = (data: unknown) => {
				if (closed) return;
				try {
					const message = `data: ${JSON.stringify(data)}\n\n`;
					controller.enqueue(encoder.encode(message));
				} catch (error) {
					logger.error("Failed to send event", error as Error);
				}
			};

			try {
				const client = opencodeClient;
				logger.info("Connecting to project OpenCode events...");

				// Initial state: we may or may not have a session yet.
				let conversation = Conversation.getByProjectId(projectId);
				let sessionId: string | null = conversation?.opencodeSessionId ?? null;

				sendEvent({
					type: "server.connected",
					projectId,
					sessionId,
				});

				const events = await client.event.subscribe();
				logger.info("Subscribed to OpenCode events successfully");

				if (
					!events ||
					typeof (events as any).stream?.[Symbol.asyncIterator] !== "function"
				) {
					throw new Error("Event stream not available or not iterable");
				}

				for await (const rawEvent of (events as any).stream) {
					if (closed) break;

					const event: any = rawEvent;

					// Extract session ID from payload
					const info = event.properties?.info ?? event.info ?? {};
					const directSessionId =
						event.properties?.sessionID ||
						event.properties?.sessionId ||
						event.properties?.session_id ||
						event.properties?.session?.id ||
						null;

					const eventSessionId =
						directSessionId ||
						info.sessionID ||
						info.sessionId ||
						info.session_id ||
						info.id ||
						info.session?.id ||
						null;

					if (!sessionId && eventSessionId) {
						// First time we learn the session ID, persist it
						conversation = Conversation.getByProjectId(projectId);
						if (conversation) {
							Conversation.updateSessionId(conversation.id, eventSessionId);
						}
						sessionId = eventSessionId;
					}

					if (!sessionId || !eventSessionId || eventSessionId !== sessionId) {
						continue;
					}

					logger.info(
						`Forwarding event ${event.type} for session ${sessionId}`,
					);

					sendEvent(event);
				}
			} catch (error) {
				if (!closed) {
					logger.error("SSE stream error", error as Error);
					const message = (error as Error).message || "Unknown error";
					sendEvent({ type: "error", message });
					controller.close();
					closed = true;
				}
			}
		},
		cancel() {
			logger.info(`SSE stream cancelled for project ${projectId}`);
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
