import type { APIRoute } from "astro";
import { getProductionVersions } from "@/server/productions/cleanup";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";

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

	// Check project exists
	const project = await getProjectById(projectId);
	if (!project) {
		return new Response("Project not found", { status: 404 });
	}

	// Get available production versions
	const versions = await getProductionVersions(projectId);

	return new Response(
		JSON.stringify({
			versions: versions.map((v) => ({
				hash: v.hash,
				isActive: v.isActive,
				createdAt: v.mtimeIso,
			})),
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
