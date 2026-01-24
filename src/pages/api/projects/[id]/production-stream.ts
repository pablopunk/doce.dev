import type { APIRoute } from "astro";
import { getProductionStatus } from "@/server/productions/productions.model";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";

export const GET: APIRoute = async ({ params, locals, request }) => {
	const projectId = params.id;

	if (!projectId) {
		return new Response("Project ID is required", { status: 400 });
	}

	const user = locals.user;
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const isOwner = await isProjectOwnedByUser(projectId, user.id);
	if (!isOwner) {
		return new Response("Forbidden", { status: 403 });
	}

	const encoder = new TextEncoder();
	let lastProjectStatus = "";
	let isClosed = false;
	const KEEP_ALIVE_INTERVAL_MS = 15_000;

	const stream = new ReadableStream({
		async start(controller) {
			let pollInterval: NodeJS.Timeout | null = null;
			let timeoutHandle: NodeJS.Timeout | null = null;

			const cleanup = () => {
				isClosed = true;
				if (pollInterval) clearInterval(pollInterval);
				if (timeoutHandle) clearTimeout(timeoutHandle);
				if (keepAliveTimer) clearInterval(keepAliveTimer);
			};

			const sendKeepAlive = () => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(": keep-alive\n\n"));
				} catch {
					// Stream closed
					isClosed = true;
				}
			};

			const keepAliveTimer = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL_MS);

			try {
				const project = await getProjectById(projectId);
				if (project) {
					const status = getProductionStatus(project);
					lastProjectStatus = status.status || "stopped";
					const event = `event: production.status\ndata: ${JSON.stringify({
						status: status.status,
						url: status.url,
						port: status.port,
						error: status.error,
						startedAt: status.startedAt?.toISOString() || null,
					})}\n\n`;
					controller.enqueue(encoder.encode(event));
				}

				pollInterval = setInterval(async () => {
					if (isClosed) {
						if (pollInterval) clearInterval(pollInterval);
						return;
					}

					try {
						const updatedProject = await getProjectById(projectId);
						if (!updatedProject) {
							cleanup();
							controller.close();
							return;
						}

						const status = getProductionStatus(updatedProject);
						const newStatus = status.status || "stopped";

						if (!isClosed && newStatus !== lastProjectStatus) {
							lastProjectStatus = newStatus;
							const event = `event: production.status\ndata: ${JSON.stringify({
								status: status.status,
								url: status.url,
								port: status.port,
								error: status.error,
								startedAt: status.startedAt?.toISOString() || null,
							})}\n\n`;
							try {
								controller.enqueue(encoder.encode(event));
							} catch {
								isClosed = true;
							}
						}
					} catch {
						// Error in polling
					}
				}, 2000);

				// 5 minute timeout for safety
				timeoutHandle = setTimeout(
					() => {
						cleanup();
						try {
							controller.close();
						} catch {}
					},
					5 * 60 * 1000,
				);

				// Handle client disconnect
				request.signal?.addEventListener("abort", () => {
					cleanup();
					controller.close();
				});
			} catch (_error) {
				cleanup();
				controller.close();
			}
		},

		cancel() {
			isClosed = true;
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
