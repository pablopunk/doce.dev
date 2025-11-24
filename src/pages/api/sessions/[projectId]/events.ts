import type { APIRoute } from "astro";
import { Conversation } from "@/domain/conversations/models/conversation";
import { createLogger } from "@/lib/logger";
import { getOpencodeClient, getOpencodeServer } from "@/lib/opencode";

const logger = createLogger("session-events");

export const maxDuration = 300;

export const GET: APIRoute = async ({ params }) => {
	const projectId = params.projectId;
	logger.info(`SSE request for project ${projectId}`);

	if (!projectId) {
		logger.error("No project ID provided");
		return new Response("Project ID required", { status: 400 });
	}

	try {
		await getOpencodeServer();
		logger.info("OpenCode server is running");
	} catch (error) {
		logger.error("Failed to start OpenCode server", error as Error);
		return new Response("OpenCode server not available", { status: 503 });
	}

	let conversation = Conversation.getByProjectId(projectId);

	// If no conversation exists yet, create one (this happens on new projects)
	if (!conversation) {
		logger.info(`No conversation found for project ${projectId}, creating one`);
		conversation = Conversation.create(projectId);
	}

	// Session will be created lazily when first message is sent
	// For now, just keep the connection alive and wait
	if (!conversation.opencodeSessionId) {
		logger.info(`No OpenCode session yet for project ${projectId}, waiting...`);
	}

	const sessionId = conversation.opencodeSessionId;
	logger.info(
		`Starting SSE stream for project ${projectId} (session: ${sessionId || "pending"})`,
	);

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const sendEvent = (data: any) => {
				try {
					const message = `data: ${JSON.stringify(data)}\n\n`;
					controller.enqueue(encoder.encode(message));
				} catch (error) {
					logger.error("Failed to send event", error as Error);
				}
			};

			try {
				const client = getOpencodeClient();
				logger.info("Got OpenCode client, subscribing to events...");

				sendEvent({
					type: "connected",
					projectId,
					sessionId: sessionId || null,
				});

				// If no session yet, poll for session creation
				if (!sessionId) {
					logger.info("No session yet, polling for session creation...");

					// Poll every 2 seconds for session creation
					let currentSessionId: string | null = null;
					const pollInterval = setInterval(async () => {
						const updatedConv = Conversation.getByProjectId(projectId);
						if (updatedConv?.opencodeSessionId && !currentSessionId) {
							currentSessionId = updatedConv.opencodeSessionId;
							clearInterval(pollInterval);
							logger.info(
								`Session created: ${currentSessionId}, reconnecting...`,
							);
							sendEvent({
								type: "session.created",
								sessionId: currentSessionId,
							});
							// Close this connection - client will reconnect
							controller.close();
						}
					}, 2000);

					// Keep connection alive with pings
					const _pingInterval = setInterval(() => {
						sendEvent({ type: "ping" });
					}, 30000);

					// Cleanup handled by cancel()
					return;
				}

				const events = await client.event.subscribe();
				logger.info("Subscribed to OpenCode events successfully");

				if (
					!events ||
					typeof events.stream?.[Symbol.asyncIterator] !== "function"
				) {
					throw new Error("Event stream not available or not iterable");
				}

				for await (const globalEvent of events.stream) {
					// GlobalEvent has structure: { directory: string, payload: Event }
					// Event has structure: { type: string, properties: { info: Message | Session } }
					const event = (globalEvent as any).payload;

					if (!event) {
						continue;
					}

					// Extract sessionID from the event payload
					const eventSessionId = event.properties?.info?.sessionID;

					if (!eventSessionId || eventSessionId !== sessionId) {
						// Skip events from other sessions
						continue;
					}

					logger.info(
						`Processing event: ${event.type} for session ${sessionId}`,
					);

					sendEvent({
						type: event.type,
						...event.properties,
					});

					if (event.type === "message.updated") {
						try {
							const messages = await client.session.messages({
								path: { id: sessionId },
							});

							if (messages.data) {
								const textMessages = messages.data.map((msg) => {
									const textParts = msg.parts
										.filter((p: any) => p.type === "text")
										.map((p: any) => p.text)
										.join("\n");

									return {
										id: msg.info.id,
										role: msg.info.role,
										content: textParts,
										streamingStatus:
											msg.info.role === "assistant" &&
											!(msg.info as any).time?.completed
												? "streaming"
												: "complete",
									};
								});

								Conversation.deleteMessagesFromIndex(conversation.id, 0);

								for (const msg of textMessages) {
									Conversation.saveMessage(
										conversation.id,
										msg.role as "user" | "assistant",
										msg.content,
										msg.streamingStatus as any,
									);
								}

								sendEvent({
									type: "messages.synced",
									count: textMessages.length,
								});
							}
						} catch (syncError) {
							logger.error("Failed to sync messages", syncError as Error);
						}
					}
				}
			} catch (error) {
				logger.error("SSE stream error", error as Error);
				sendEvent({ type: "error", message: (error as Error).message });
				controller.close();
			}
		},
		cancel() {
			logger.info(`SSE stream cancelled for session ${sessionId}`);
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
