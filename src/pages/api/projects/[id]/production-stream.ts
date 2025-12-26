import type { APIRoute } from "astro";
import { isProjectOwnedByUser } from "@/server/projects/projects.model";
import { getProjectById } from "@/server/projects/projects.model";
import { getProductionStatus } from "@/server/productions/productions.model";

export const GET: APIRoute = async ({ params, locals }) => {
	const projectId = params.id;

	if (!projectId) {
		return new Response("Project ID is required", { status: 400 });
	}

	// Check authentication
	const user = locals.user;
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	// Check ownership
	const isOwner = await isProjectOwnedByUser(projectId, user.id);
	if (!isOwner) {
		return new Response("Forbidden", { status: 403 });
	}

	// Create SSE stream
	const encoder = new TextEncoder();
	let lastProjectStatus = "";

	const stream = new ReadableStream({
		async start(controller) {
			try {
				// Send initial status
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

				// Poll for updates every 2 seconds
				const pollInterval = setInterval(async () => {
					try {
						const updatedProject = await getProjectById(projectId);
						if (!updatedProject) {
							clearInterval(pollInterval);
							controller.close();
							return;
						}

						const status = getProductionStatus(updatedProject);
						const newStatus = status.status || "stopped";

						// Only send if status changed
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
					} catch (error) {
						console.error("Error polling production status:", error);
					}
				}, 2000);

				// Clean up interval when client disconnects
				// This is handled by the browser closing the connection
				setTimeout(
					() => {
						clearInterval(pollInterval);
					},
					5 * 60 * 1000,
				); // 5 minute timeout
			} catch (error) {
				console.error("Error in production stream:", error);
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
