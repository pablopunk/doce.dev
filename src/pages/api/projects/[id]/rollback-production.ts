import { promises as fs } from "node:fs";
import type { APIRoute } from "astro";
import {
	composeDownProduction,
	composeUpProduction,
} from "@/server/docker/compose";
import { logger } from "@/server/logger";
import {
	cleanupOldProductionVersions,
	getProductionVersions,
} from "@/server/productions/cleanup";
import { updateProductionStatus } from "@/server/productions/productions.model";
import {
	getProductionCurrentSymlink,
	getProductionPath,
} from "@/server/projects/paths";
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

		logger.info(
			{ projectId, from: currentHash, to: targetHash },
			"Starting production rollback",
		);

		// Stop current version
		if (project.productionPort) {
			try {
				const currentPath = getProductionPath(projectId, currentHash);
				await composeDownProduction(projectId, currentPath, currentHash);
				logger.debug({ projectId, currentHash }, "Stopped current production");
			} catch (error) {
				logger.error(
					{ projectId, currentHash, error },
					"Failed to stop current production",
				);
				// Continue with startup - previous version should handle cleanup
			}
		}

		// Update symlink to point to target version
		const symlinkPath = getProductionCurrentSymlink(projectId);
		const projectDir = getProductionPath(projectId);
		await fs.mkdir(projectDir, { recursive: true });

		const tempSymlink = `${symlinkPath}.tmp-${Date.now()}`;
		try {
			await fs.unlink(tempSymlink).catch(() => {});
			await fs.symlink(targetHash, tempSymlink);
			await fs.rename(tempSymlink, symlinkPath);
			logger.debug(
				{ projectId, symlinkPath, target: targetHash },
				"Updated symlink",
			);
		} catch (error) {
			logger.error({ projectId, error }, "Failed to update symlink");
			throw error;
		}

		// Start target version
		try {
			const targetPath = getProductionPath(projectId, targetHash);
			const result = await composeUpProduction(
				projectId,
				targetPath,
				project.productionPort || 3001, // Fallback port if not set
				targetHash,
			);

			if (!result.success) {
				throw new Error(`Failed to start target version: ${result.stderr}`);
			}

			logger.debug({ projectId, targetHash }, "Started target production");
		} catch (error) {
			logger.error(
				{ projectId, targetHash, error },
				"Failed to start target version",
			);
			throw error;
		}

		// Update database
		await updateProductionStatus(projectId, "running", {
			productionHash: targetHash,
			productionStartedAt: new Date(),
		});

		logger.info(
			{ projectId, from: currentHash, to: targetHash },
			"Production rollback completed",
		);

		// Clean up old versions
		await cleanupOldProductionVersions(projectId, 2).catch((error) => {
			logger.warn({ projectId, error }, "Failed to cleanup old versions");
		});

		return new Response(
			JSON.stringify({
				success: true,
				hash: targetHash,
				message: `Rolled back to version ${targetHash}`,
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
