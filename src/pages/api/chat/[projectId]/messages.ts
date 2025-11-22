import type { APIRoute } from "astro";
import { chatEvents } from "@/domain/conversations/lib/events";
import { Conversation } from "@/domain/conversations/models/conversation";
import {
	getToolStatus,
	setToolStatus,
} from "@/domain/conversations/lib/tool-status";
import { createLogger } from "@/lib/logger";

const logger = createLogger("messages-api");

/**
 * Server-Sent Events endpoint for real-time message updates
 * Similar to docker logs SSE - pushes updates when they happen (no polling!)
 */
export const GET: APIRoute = async ({ params }) => {
	const projectId = params.projectId;
	if (!projectId) {
		return Response.json({ error: "Project id is required" }, { status: 400 });
	}

	logger.info(`Client connecting for project ${projectId}`);

	// Get conversation
	const conversation = Conversation.getByProjectId(projectId);
	if (!conversation) {
		logger.warn(`No conversation found for project ${projectId}`);
		return Response.json({ error: "Conversation not found" }, { status: 404 });
	}

	logger.info(`Found conversation ${conversation.id} for project ${projectId}`);

	const encoder = new TextEncoder();
	let keepaliveInterval: NodeJS.Timeout | null = null;

	const stream = new ReadableStream({
		start(controller) {
			// Send initial messages immediately
			const sendMessages = () => {
				try {
					const history = Conversation.getHistory(projectId);
					let messages = history.messages;
					logger.debug(
						`Sending ${messages.length} messages for project ${projectId}`,
					);
					// NOTE: We no longer clear toolStatus when there is no
					// active streaming assistant message. Tools can run before
					// or after text streaming, and the UI treats toolStatus as
					// an independent indicator of background activity.
					const rawToolStatus = getToolStatus(projectId);
					logger.debug(
						`SSE toolStatus for project ${projectId}: ${rawToolStatus}`,
					);

					// Detect if there is an active streaming assistant message
					let streamingAssistant = messages.find(
						(msg: any) =>
							msg.role === "assistant" && msg.streamingStatus === "streaming",
					);

					// If the streaming assistant message appears stuck for a long
					// time, mark it as error and clear tool status so the UI does
					// not show an infinite spinner.
					const STALE_STREAM_MS = 2 * 60 * 1000; // 2 minutes
					if (streamingAssistant && streamingAssistant.createdAt) {
						const createdAtMs = new Date(
							streamingAssistant.createdAt,
						).getTime();
						if (
							Number.isFinite(createdAtMs) &&
							Date.now() - createdAtMs > STALE_STREAM_MS
						) {
							logger.warn(
								`Streaming assistant message ${streamingAssistant.id} is stale; marking as error`,
							);
							const updated = Conversation.updateMessage(
								streamingAssistant.id,
								streamingAssistant.content || "Error: Generation timed out",
								"error",
							);
							streamingAssistant = updated as any;
							setToolStatus(projectId, null);
							// Refresh messages so subsequent logic sees updated status
							messages = Conversation.getHistory(projectId).messages;
						}
					}

					const hasStreamingAssistant = Boolean(
						messages.find(
							(msg: any) =>
								msg.role === "assistant" && msg.streamingStatus === "streaming",
						),
					);

					// Tools can run before, during, or after text streaming.
					// We keep toolStatus as-is here; the chat API clears it on
					// completion or abort. The UI treats toolStatus as an
					// independent indicator of background activity.
					let effectiveToolStatus = rawToolStatus;

					const data = JSON.stringify({
						type: "messages",
						messages: messages.map((msg: any) => ({
							id: msg.id,
							role: msg.role,
							content: msg.content,
							streamingStatus: msg.streamingStatus,
							createdAt: msg.createdAt,
						})),
						toolStatus: effectiveToolStatus,
					});

					controller.enqueue(encoder.encode(`data: ${data}\n\n`));
				} catch (error) {
					logger.error("Error sending messages", error as Error);
				}
			};

			// Send initial state
			logger.debug(`Sending initial messages for project ${projectId}`);
			sendMessages();

			// Listen for updates from the event emitter (NO POLLING!)
			const updateHandler = () => {
				logger.debug(`Event received for project ${projectId}, sending update`);
				sendMessages();
			};
			logger.debug(`Registered event listener for project:${projectId}`);
			chatEvents.on(`project:${projectId}`, updateHandler);

			// Setup keepalive every 30s
			keepaliveInterval = setInterval(() => {
				try {
					controller.enqueue(
						encoder.encode(
							": keepalive\
\
",
						),
					);
				} catch (error) {
					// Stream closed
					if (keepaliveInterval) {
						clearInterval(keepaliveInterval);
					}
				}
			}, 30000);

			// Cleanup on client disconnect
			return () => {
				logger.info(`Client disconnected from project ${projectId}`);
				chatEvents.off(`project:${projectId}`, updateHandler);
				if (keepaliveInterval) {
					clearInterval(keepaliveInterval);
				}
			};
		},
		cancel() {
			if (keepaliveInterval) {
				clearInterval(keepaliveInterval);
			}
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
