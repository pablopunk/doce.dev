import type { APIRoute } from "astro";
import { deriveVersionPort } from "@/server/ports/allocate";
import { logger } from "@/server/logger";
import { getProductionVersions } from "@/server/productions/cleanup";
import { updateProjectNginxRouting } from "@/server/productions/nginx";
import { updateProductionStatus } from "@/server/productions/productions.model";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";

export const POST: APIRoute = async ({ params, locals, request }) => {
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

	try {
		// Parse request body
		const body = (await request.json()) as { toHash?: string };
		const targetHash = body.toHash;

		if (!targetHash) {
			return new Response("Target hash is required", { status: 400 });
		}

		// Get available versions
		const versions = await getProductionVersions(projectId);
		const targetVersion = versions.find((v) => v.hash === targetHash);

		if (!targetVersion) {
			return new Response("Target version not found", { status: 404 });
		}

		// Can't rollback to the current version
		if (targetVersion.isActive) {
			return new Response("Target version is already active", { status: 400 });
		}

		const currentHash = project.productionHash;
		if (!currentHash) {
			return new Response("No active production deployment to rollback from", {
				status: 400,
			});
		}

		const basePort = project.productionBasePort;
		if (!basePort) {
			return new Response(
				"No production base port found - deployment not initialized",
				{ status: 400 },
			);
		}

		logger.info(
			{
				projectId,
				from: currentHash.slice(0, 8),
				to: targetHash.slice(0, 8),
				basePort,
			},
			"Starting instant production rollback",
		);

		// Derive version port for target version (deterministic - always same for same hash)
		const targetVersionPort = deriveVersionPort(projectId, targetHash);

		// Instantly switch nginx routing to target version
		await updateProjectNginxRouting(projectId, targetHash, targetVersionPort);

		logger.debug(
			{
				projectId,
				targetHash: targetHash.slice(0, 8),
				targetVersionPort,
			},
			"Updated nginx routing for rollback",
		);

		// Update database with new active hash
		await updateProductionStatus(projectId, "running", {
			productionHash: targetHash,
			productionStartedAt: new Date(),
		});

		// Return the public-facing URL (stays the same - base port)
		const url = `http://localhost:${basePort}`;

		logger.info(
			{
				projectId,
				from: currentHash.slice(0, 8),
				to: targetHash.slice(0, 8),
				basePort,
				url,
			},
			"Production rollback completed instantly",
		);

		return new Response(
			JSON.stringify({
				success: true,
				hash: targetHash,
				url,
				basePort,
				message: `Rolled back to version ${targetHash.slice(0, 8)} - URL unchanged`,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		logger.error({ projectId, error }, "Rollback failed");
		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Rollback failed",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
