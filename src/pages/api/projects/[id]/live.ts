import type { APIRoute } from "astro";
import { registerClient } from "@/server/live/manager";
import { isProjectOwnedByUser } from "@/server/projects/projects.model";
import type { ProjectLiveState } from "@/types/live";

export const GET: APIRoute = async ({ params, locals, request }) => {
	const projectId = params.id;
	if (!projectId) {
		return new Response("Project ID required", { status: 400 });
	}

	const user = locals.user;
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const isOwner = await isProjectOwnedByUser(projectId, user.id);
	if (!isOwner) {
		return new Response("Forbidden", { status: 403 });
	}

	const clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const encoder = new TextEncoder();

	let cleanup: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const send = (state: ProjectLiveState) => {
				try {
					const data = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
					controller.enqueue(encoder.encode(data));
				} catch {
					// Controller closed — cleanup will handle it
				}
			};

			cleanup = registerClient(projectId, clientId, send);

			request.signal.addEventListener("abort", () => {
				cleanup?.();
				cleanup = null;
				try {
					controller.close();
				} catch {}
			});
		},

		cancel() {
			cleanup?.();
			cleanup = null;
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no", // disable nginx buffering
		},
	});
};
