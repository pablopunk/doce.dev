import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { logger } from "@/server/logger";
import {
	createNormalizationState,
	normalizeEvent,
	parseSSEData,
} from "@/server/opencode/normalize";
import {
	getProjectById,
	isProjectOwnedByUser,
	markUserPromptCompleted,
} from "@/server/projects/projects.model";

const SESSION_COOKIE_NAME = "doce_session";
const KEEP_ALIVE_INTERVAL_MS = 15_000;
const CONNECT_TIMEOUT_MS = 10_000;

export const GET: APIRoute = async ({ params, cookies }) => {
	// Validate session
	const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!sessionToken) {
		return new Response("Unauthorized", { status: 401 });
	}

	const session = await validateSession(sessionToken);
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const projectId = params.id;
	if (!projectId) {
		return new Response("Project ID required", { status: 400 });
	}

	// Verify project ownership
	const isOwner = await isProjectOwnedByUser(projectId, session.user.id);
	if (!isOwner) {
		return new Response("Not found", { status: 404 });
	}

	const project = await getProjectById(projectId);
	if (!project) {
		return new Response("Not found", { status: 404 });
	}

	// Connect to upstream opencode SSE using container hostname for inter-container communication
	const upstreamUrl = `http://doce_${projectId}-opencode-1:3000/event`;

	let upstreamResponse: Response;
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

		upstreamResponse = await fetch(upstreamUrl, {
			headers: { Accept: "text/event-stream" },
			signal: controller.signal,
		});

		clearTimeout(timeout);

		if (!upstreamResponse.ok) {
			return new Response(`Upstream error: ${upstreamResponse.status}`, {
				status: 502,
			});
		}

		if (!upstreamResponse.body) {
			return new Response("No response body", { status: 502 });
		}
	} catch (error) {
		logger.warn({ error, projectId }, "Failed to connect to opencode SSE");
		return new Response("Failed to connect to opencode", { status: 502 });
	}

	const encoder = new TextEncoder();
	const decoder = new TextDecoder();
	const state = createNormalizationState();
	let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
	let isClosed = false;
	let dataBuffer = "";

	// Track completion state for this connection
	// First idle = user prompt completed (session.init already done in template)
	let hasMarkedUserPromptCompleted = project.userPromptCompleted;

	/**
	 * Check if the user prompt has completed (session.init was done in template).
	 * Listens for the first idle event to mark setup complete.
	 * This is called server-side so it works even if client disconnects.
	 */
	const checkPromptCompletion = async (
		parsed: { type: string; properties?: Record<string, unknown> },
		sendEvent: (event: object) => void,
	) => {
		// Check session.status events for idle status
		if (parsed.type !== "session.status") return;

		const properties = parsed.properties as
			| { status?: { type?: string } }
			| undefined;
		const status = properties?.status?.type;

		// Only process idle events
		if (status !== "idle") return;

		// Re-fetch project to get latest state (in case it was updated elsewhere)
		const currentProject = await getProjectById(projectId);
		if (!currentProject) return;

		// Don't process if prompts haven't been sent yet
		if (!currentProject.initialPromptSent) return;

		logger.debug(
			{
				projectId,
				hasMarkedUserPromptCompleted,
			},
			"Received idle event",
		);

		// First idle event = user prompt completed (session.init was pre-done in template)
		if (!hasMarkedUserPromptCompleted) {
			logger.info({ projectId }, "User prompt completed - marking in database");
			await markUserPromptCompleted(projectId);
			hasMarkedUserPromptCompleted = true;

			// Send setup.complete event
			sendEvent({
				type: "setup.complete",
				payload: {},
			});
		}
	};

	// Callback to send events from within the stream
	let sendEventFn: ((event: object) => void) | null = null;

	const stream = new ReadableStream({
		async start(controller) {
			const sendEvent = (event: object) => {
				if (isClosed) return;
				try {
					controller.enqueue(
						encoder.encode(
							`event: chat.event\ndata: ${JSON.stringify(event)}\n\n`,
						),
					);
				} catch {
					// Stream closed
				}
			};

			// Store sendEvent for use in checkInitialPromptCompletion
			sendEventFn = sendEvent;

			const sendKeepAlive = () => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(": keep-alive\n\n"));
				} catch {
					// Stream closed
				}
			};

			// Start keep-alive timer
			keepAliveTimer = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL_MS);

			// Read from upstream
			const reader = upstreamResponse.body!.getReader();

			try {
				while (!isClosed) {
					const { done, value } = await reader.read();

					if (done) {
						break;
					}

					// Decode and process SSE data
					const chunk = decoder.decode(value, { stream: true });
					dataBuffer += chunk;

					// Process complete lines
					const lines = dataBuffer.split("\n");
					dataBuffer = lines.pop() ?? ""; // Keep incomplete line in buffer

					for (const line of lines) {
						const trimmed = line.trim();

						// Skip empty lines and comments
						if (!trimmed || trimmed.startsWith(":")) {
							continue;
						}

						// Parse data lines
						if (trimmed.startsWith("data:")) {
							const data = trimmed.slice(5).trim();
							const parsed = parseSSEData(data);

							if (parsed) {
								// Check for prompt completion (server-side detection)
								// Cast to simple shape for prompt completion check
								const eventForCheck = parsed as {
									type: string;
									properties?: Record<string, unknown>;
								};
								if (sendEventFn) {
									checkPromptCompletion(eventForCheck, sendEventFn).catch(
										(error: unknown) => {
											logger.error(
												{ error, projectId },
												"Error checking prompt completion",
											);
										},
									);
								}

								const normalized = normalizeEvent(projectId, parsed, state);
								if (normalized) {
									sendEvent(normalized);
								}
							}
						}
					}
				}
			} catch (error) {
				if (!isClosed) {
					logger.error({ error, projectId }, "Error reading upstream SSE");
				}
			} finally {
				reader.releaseLock();
				if (!isClosed) {
					controller.close();
				}
			}
		},

		cancel() {
			isClosed = true;
			if (keepAliveTimer) clearInterval(keepAliveTimer);
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
