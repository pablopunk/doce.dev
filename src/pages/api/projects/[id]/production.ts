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

	// Get project
	const project = await getProjectById(projectId);
	if (!project) {
		return new Response("Project not found", { status: 404 });
	}

	// Get production status
	const status = getProductionStatus(project);

	return new Response(
		JSON.stringify({
			status: status.status,
			url: status.url,
			port: status.port,
			error: status.error,
			startedAt: status.startedAt?.toISOString() || null,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
