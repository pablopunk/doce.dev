import type { APIRoute } from "astro";
import { requireAuth } from "@/server/auth/requireAuth";
import { getProjectById } from "@/server/projects/projects.model";

export const GET: APIRoute = async ({ params, cookies }) => {
	const auth = await requireAuth(cookies);
	if (!auth.ok) return auth.response;

	const projectId = params.id;
	if (!projectId) {
		return new Response(JSON.stringify({ error: "Project ID required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const project = await getProjectById(projectId);

		if (!project || project.ownerUserId !== auth.user.id) {
			return new Response(JSON.stringify({ error: "Not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response(JSON.stringify(project), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
