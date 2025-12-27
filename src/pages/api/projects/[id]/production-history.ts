import type { APIRoute } from "astro";
import { deriveVersionPort } from "@/server/ports/allocate";
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
	const basePort = project.productionBasePort;

	return new Response(
		JSON.stringify({
			basePort,
			baseUrl: basePort ? `http://localhost:${basePort}` : null,
			versions: versions.map((v) => {
				const versionPort = deriveVersionPort(projectId, v.hash);
				return {
					hash: v.hash,
					isActive: v.isActive,
					createdAt: v.mtimeIso,
					// Active version: public-facing URL on base port
					// Inactive versions: accessible on their own version port
					url:
						v.isActive && basePort ? `http://localhost:${basePort}` : undefined,
					basePort,
					versionPort,
					previewUrl: `http://localhost:${versionPort}`,
				};
			}),
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
