import type { APIRoute } from "astro";
import { getProductionStatus } from "@/server/productions/productions.model";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";

export const GET: APIRoute = async ({ params, locals }) => {
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
	const KEEP_ALIVE_INTERVAL_MS = 15_000;

	const stream = new ReadableStream({
		async start(controller) {
			const sendKeepAlive = () => {
				try {
					controller.enqueue(encoder.encode(": keep-alive\n\n"));
				} catch {}
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

				const pollInterval = setInterval(async () => {
					try {
						const updatedProject = await getProjectById(projectId);
						if (!updatedProject) {
							clearInterval(pollInterval);
							clearInterval(keepAliveTimer);
							controller.close();
							return;
						}

						const status = getProductionStatus(updatedProject);
						const newStatus = status.status || "stopped";

						if (newStatus !== lastProjectStatus) {
							lastProjectStatus = newStatus;
							const event = `event: production.status\ndata: ${JSON.stringify({
								status: status.status,
								url: status.url,
								port: status.port,
								error: status.error,
								startedAt: status.startedAt?.toISOString() || null,
							})}\n\n`;
							controller.enqueue(encoder.encode(event));
						}
					} catch {
						// Error in polling
					}
				}, 2000);

				// 5 minute timeout for safety
				setTimeout(
					() => {
						clearInterval(pollInterval);
						clearInterval(keepAliveTimer);
						try {
							controller.close();
						} catch {}
					},
					5 * 60 * 1000,
				);
			} catch (error) {
				clearInterval(keepAliveTimer);
				controller.close();
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
