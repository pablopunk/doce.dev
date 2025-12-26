import type { APIRoute } from "astro";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";
import { enqueueProductionStop } from "@/server/queue/enqueue";
import {
	getActiveProductionJob,
	getProductionStatus,
} from "@/server/productions/productions.model";

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

	// Check if production is running
	const status = getProductionStatus(project);
	if (status.status !== "running") {
		return new Response(
			JSON.stringify({
				success: false,
				message: `Cannot stop production server (current status: ${status.status})`,
			}),
			{
				status: 409,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Check if a stop job is already in progress
	const activeJob = await getActiveProductionJob(projectId);
	if (activeJob?.type === "production.stop") {
		return new Response(
			JSON.stringify({
				success: false,
				message: "Production stop already in progress",
			}),
			{
				status: 409,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Enqueue production stop job
	await enqueueProductionStop(projectId);

	return new Response(
		JSON.stringify({
			success: true,
			message: "Production stop requested",
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
