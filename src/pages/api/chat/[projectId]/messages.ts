import type { APIRoute } from "astro";
import { getConversation, getMessages } from "@/lib/db";
import { chatEvents } from "@/lib/chat-events";

/**
 * Server-Sent Events endpoint for real-time message updates
 * Similar to docker logs SSE - pushes updates when they happen (no polling!)
 */
export const GET: APIRoute = async ({ params }) => {
	const projectId = params.projectId;
	if (!projectId) {
		return Response.json({ error: "Project id is required" }, { status: 400 });
	}

	console.log(`[SSE] Client connecting for project ${projectId}`);

	// Get conversation
	const conversation = await getConversation(projectId);
	if (!conversation) {
		console.log(`[SSE] No conversation found for project ${projectId}`);
		return Response.json({ error: "Conversation not found" }, { status: 404 });
	}

	console.log(
		`[SSE] Found conversation ${conversation.id} for project ${projectId}`,
	);

	const encoder = new TextEncoder();
	let keepaliveInterval: NodeJS.Timeout | null = null;

	const stream = new ReadableStream({
		start(controller) {
			// Send initial messages immediately
			const sendMessages = () => {
				try {
					const messages = getMessages(conversation.id);
					console.log(
						`[SSE] Sending ${messages.length} messages for project ${projectId}`,
					);
					const data = JSON.stringify({
						type: "messages",
						messages: messages.map((msg: any) => ({
							id: msg.id,
							role: msg.role,
							content: msg.content,
							streaming_status: msg.streaming_status,
							created_at: msg.created_at,
						})),
					});
					controller.enqueue(encoder.encode(`data: ${data}\n\n`));
				} catch (error) {
					console.error("[SSE] Error sending messages:", error);
				}
			};

			// Send initial state
			console.log(`[SSE] Sending initial messages for project ${projectId}`);
			sendMessages();

			// Listen for updates from the event emitter (NO POLLING!)
			const updateHandler = () => {
				console.log(
					`[SSE] Event received for project ${projectId}, sending update`,
				);
				sendMessages();
			};
			console.log(`[SSE] Registered event listener for project:${projectId}`);
			chatEvents.on(`project:${projectId}`, updateHandler);

			// Setup keepalive every 30s
			keepaliveInterval = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": keepalive\n\n"));
				} catch (error) {
					// Stream closed
					if (keepaliveInterval) {
						clearInterval(keepaliveInterval);
					}
				}
			}, 30000);

			// Cleanup on client disconnect
			return () => {
				console.log(`[SSE] Client disconnected from project ${projectId}`);
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
