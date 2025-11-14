import type { APIRoute } from "astro";
import { streamContainerLogs } from "@/lib/docker";
import { projects } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const logger = createLogger("logs-api");

export const GET: APIRoute = async ({ params, request }) => {
	const projectId = params.id;
	if (!projectId) {
		return new Response("Project ID required", { status: 400 });
	}

	try {
		// Get project to check for stored build logs
		const project = projects.getById(projectId) as any;

		// Get the log stream from Docker
		const logStream = await streamContainerLogs(projectId);

		logger.info(`Starting log stream for project ${projectId}`);

		// Create WebSocket connection
		// Note: In production with Node adapter, we need to handle WebSocket differently
		// For now, we'll use Server-Sent Events (SSE) which works better with Astro
		const encoder = new TextEncoder();

		// Send keepalive comments every 15 seconds to prevent connection timeout
		let keepaliveInterval: NodeJS.Timeout | null = null;

		const stream = new ReadableStream({
			async start(controller) {
				// First, send stored build logs if available
				if (project?.build_logs) {
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ log: "=== Build/Deployment Logs ===\n" })}\n\n`,
						),
					);
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ log: project.build_logs })}\n\n`,
						),
					);
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({ log: "\n=== Container Logs ===\n" })}\n\n`,
						),
					);
				}

				// If container is not running, only show build logs
				if (!logStream) {
					if (!project?.build_logs) {
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({ log: "No logs available (container not running)\n" })}\n\n`,
							),
						);
					}
					// Keep connection open for a bit then close
					setTimeout(() => controller.close(), 1000);
					return;
				}

				// Send connection message for container logs
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ log: "✓ Connected to container\n" })}\n\n`,
					),
				);

				// Setup keepalive
				keepaliveInterval = setInterval(() => {
					try {
						// SSE comment (starts with :) keeps connection alive
						controller.enqueue(encoder.encode(": keepalive\n\n"));
					} catch (error) {
						// Stream already closed
						if (keepaliveInterval) {
							clearInterval(keepaliveInterval);
						}
					}
				}, 15000);

				// Docker logs come in a special format with 8-byte headers
				// We need to parse them correctly
				logStream.on("data", (chunk: Buffer) => {
					try {
						// Try to parse Docker multiplexed format first
						let parsed = false;
						let offset = 0;

						// Check if this looks like multiplexed format (starts with 0,1,2 as stream type)
						if (
							chunk.length >= 8 &&
							(chunk[0] === 0 || chunk[0] === 1 || chunk[0] === 2)
						) {
							while (offset < chunk.length) {
								// Docker multiplexes stdout/stderr with 8-byte headers
								// [stream_type(1)][padding(3)][size(4)]
								if (offset + 8 > chunk.length) break;

								const header = chunk.slice(offset, offset + 8);
								const size = header.readUInt32BE(4);

								if (size === 0 || offset + 8 + size > chunk.length) break;

								const payload = chunk.slice(offset + 8, offset + 8 + size);
								const text = payload.toString("utf-8");

								// Send as SSE format
								controller.enqueue(
									encoder.encode(`data: ${JSON.stringify({ log: text })}\n\n`),
								);

								offset += 8 + size;
								parsed = true;
							}
						}

						// If not multiplexed format, just send as plain text
						if (!parsed) {
							const text = chunk.toString("utf-8");
							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify({ log: text })}\n\n`),
							);
						}
					} catch (error) {
						logger.error(
							"Error parsing log chunk",
							error instanceof Error ? error : new Error(String(error)),
						);
						// Fallback: send raw text on error
						try {
							const text = chunk.toString("utf-8");
							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify({ log: text })}\n\n`),
							);
						} catch (e) {
							// Ignore if we can't even convert to text
						}
					}
				});

				logStream.on("end", () => {
					if (keepaliveInterval) {
						clearInterval(keepaliveInterval);
					}
					controller.close();
				});

				logStream.on("error", (error: Error) => {
					logger.error("Log stream error", error);
					if (keepaliveInterval) {
						clearInterval(keepaliveInterval);
					}
					controller.error(error);
				});
			},
			cancel() {
				if (keepaliveInterval) {
					clearInterval(keepaliveInterval);
				}
				if (
					logStream &&
					"destroy" in logStream &&
					typeof logStream.destroy === "function"
				) {
					logStream.destroy();
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
	} catch (error) {
		logger.error(
			"Failed to stream logs",
			error instanceof Error ? error : new Error(String(error)),
		);
		return new Response("Failed to stream logs", { status: 500 });
	}
};
