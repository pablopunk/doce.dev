import type { APIRoute } from "astro";
import { requireAuth } from "@/server/auth/requireAuth";
import { getProjectById } from "@/server/projects/projects.model";

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 30_000;

export const GET: APIRoute = async ({ params, cookies, request }) => {
	const auth = await requireAuth(cookies);
	if (!auth.ok) return auth.response;

	const projectId = params.id;
	if (!projectId) {
		return new Response("Project ID required", { status: 400 });
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		start(controller) {
			let closed = false;
			let interval: ReturnType<typeof setInterval> | null = null;
			let timeout: ReturnType<typeof setTimeout> | null = null;

			const cleanup = () => {
				closed = true;
				if (interval) clearInterval(interval);
				if (timeout) clearTimeout(timeout);
			};

			const send = (event: string, data: unknown) => {
				if (closed) return;
				controller.enqueue(
					encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
				);
			};

			const check = async () => {
				try {
					const project = await getProjectById(projectId);
					if (!project) return;

					if (project.ownerUserId !== auth.user.id) {
						send("error", { message: "Forbidden" });
						cleanup();
						controller.close();
						return;
					}

					send("ready", { id: project.id, slug: project.slug });
					cleanup();
					controller.close();
				} catch (error) {
					send("error", {
						message:
							error instanceof Error ? error.message : "Failed to check project",
					});
					cleanup();
					controller.close();
				}
			};

			interval = setInterval(() => {
				void check();
			}, POLL_INTERVAL_MS);
			void check();

			timeout = setTimeout(() => {
				send("timeout", { message: "Timed out waiting for project" });
				cleanup();
				controller.close();
			}, TIMEOUT_MS);

			request.signal.addEventListener("abort", () => {
				cleanup();
				try {
					controller.close();
				} catch {}
			});
		},
		cancel() {},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
};
