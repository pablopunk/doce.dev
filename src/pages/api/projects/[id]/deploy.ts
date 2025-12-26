import type { APIRoute } from "astro";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";
import { enqueueProductionBuild } from "@/server/queue/enqueue";
import { getActiveProductionJob } from "@/server/productions/productions.model";

export const POST: APIRoute = async ({ params, locals }) => {
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

	// Check if a production job is already in progress
	const activeJob = await getActiveProductionJob(projectId);
	if (activeJob) {
		return new Response(
			JSON.stringify({
				success: false,
				message: `Deployment already in progress (${activeJob.type})`,
			}),
			{
				status: 409,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Enqueue production build job
	await enqueueProductionBuild({ projectId });

	return new Response(
		JSON.stringify({
			success: true,
			message: "Deployment started",
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
