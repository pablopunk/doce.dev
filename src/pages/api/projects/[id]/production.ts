import type { APIRoute } from "astro";
import { isProjectOwnedByUser } from "@/server/projects/projects.model";
import { getProjectById } from "@/server/projects/projects.model";
import {
	getProductionStatus,
	getActiveProductionJob,
} from "@/server/productions/productions.model";

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

	// Get production status and active job
	const status = getProductionStatus(project);
	const activeJob = await getActiveProductionJob(projectId);

	return new Response(
		JSON.stringify({
			status: status.status,
			url: status.url,
			port: status.port,
			error: status.error,
			startedAt: status.startedAt?.toISOString() || null,
			activeJob: activeJob
				? {
						type: activeJob.type,
						state: activeJob.state,
					}
				: null,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
