import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { cleanupOldProductionVersions } from "@/server/productions/cleanup";
import { updateProductionStatus } from "@/server/productions/productions.model";
import {
	getProductionCurrentSymlink,
	getProductionPath,
} from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { spawnCommand } from "@/server/utils/execAsync";
import { enqueueProductionWaitReady } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

export async function handleProductionStart(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("production.start", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		logger.warn(
			{ projectId: payload.projectId },
			"Project not found for production.start",
		);
		return;
	}

	if (project.status === "deleting") {
		logger.info(
			{ projectId: project.id },
			"Skipping production.start for deleting project",
		);
		return;
	}

	if (!project.productionPort) {
		logger.warn(
			{ projectId: project.id },
			"Project has no productionPort, skipping deployment",
		);
		return;
	}

	try {
		const productionPath = getProductionPath(
			project.id,
			payload.productionHash,
		);
		const productionPort = project.productionPort;

		await ctx.throwIfCancelRequested();

		// Stop any existing production container for this project
		await stopProductionContainer(project.id);

		// Build Docker image for this version
		const imageName = `doce-prod-${project.id}-${payload.productionHash}`;
		logger.info(
			{ projectId: project.id, imageName },
			"Building production Docker image",
		);

		const buildResult = await spawnCommand(
			"docker",
			["build", "-t", imageName, "-f", "Dockerfile.prod", "."],
			{ cwd: productionPath },
		);

		if (!buildResult.success) {
			const errorMsg = `Docker build failed: ${buildResult.stderr.slice(0, 500)}`;
			logger.error(
				{ projectId: project.id, error: errorMsg },
				"Docker build failed",
			);
			await updateProductionStatus(project.id, "failed", {
				productionError: errorMsg,
			});
			throw new Error(errorMsg);
		}

		logger.info(
			{ projectId: project.id, imageName },
			"Docker image built successfully",
		);

		await ctx.throwIfCancelRequested();

		// Start container with docker run (no nginx needed)
		const containerName = `doce-prod-${project.id}`;
		logger.info(
			{ projectId: project.id, containerName, productionPort },
			"Starting production container",
		);

		const runResult = await spawnCommand("docker", [
			"run",
			"-d",
			"--name",
			containerName,
			"-p",
			`${productionPort}:3000`,
			"--restart",
			"unless-stopped",
			imageName,
		]);

		if (!runResult.success) {
			const errorMsg = `Docker run failed: ${runResult.stderr.slice(0, 500)}`;
			logger.error(
				{ projectId: project.id, error: errorMsg },
				"Docker run failed",
			);
			await updateProductionStatus(project.id, "failed", {
				productionError: errorMsg,
			});
			throw new Error(errorMsg);
		}

		logger.info(
			{
				projectId: project.id,
				containerName,
				productionPort,
			} as unknown as typeof runResult & {
				containerName: string;
				productionPort: number;
				projectId: string;
			},
			"Production container started",
		);
		// Update the "current" symlink to point to this version
		const symlinkPath = getProductionCurrentSymlink(project.id);
		await fs.mkdir(path.dirname(symlinkPath), { recursive: true });

		// Use full path to hash directory as symlink target
		const hashPath = getProductionPath(project.id, payload.productionHash);
		// Add random component to avoid collision if two builds complete at same millisecond
		const tempSymlink = `${symlinkPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		try {
			await fs.unlink(tempSymlink).catch(() => {});
			await fs.symlink(hashPath, tempSymlink);
			await fs.rename(tempSymlink, symlinkPath);

			logger.debug(
				{
					projectId: project.id,
					symlinkPath,
					target: hashPath,
				},
				"Updated production current symlink",
			);
		} catch (error) {
			logger.error(
				{ projectId: project.id, error },
				"Failed to update production symlink",
			);
			throw error;
		}

		// Update production status
		await updateProductionStatus(project.id, "building", {
			productionStartedAt: new Date(),
			productionHash: payload.productionHash,
		});

		// Enqueue waitReady with production port
		await enqueueProductionWaitReady({
			projectId: project.id,
			productionPort,
			startedAt: Date.now(),
			rescheduleCount: 0,
		});

		logger.debug(
			{
				projectId: project.id,
				productionPort,
				hash: payload.productionHash.slice(0, 8),
			},
			"Enqueued production.waitReady",
		);

		// Clean up old production versions (keep last 2)
		cleanupOldProductionVersions(project.id, 2).catch((error) => {
			logger.warn(
				{ projectId: project.id, error },
				"Failed to cleanup old production versions",
			);
		});
	} catch (error) {
		logger.error(
			{ projectId: project.id, error },
			"production.start handler failed",
		);
		throw error;
	}
}

/**
 * Stop the existing production container for a project.
 */
async function stopProductionContainer(projectId: string): Promise<void> {
	const containerName = `doce-prod-${projectId}`;

	try {
		// Try to stop container
		await spawnCommand("docker", ["stop", containerName]);

		// Remove container
		await spawnCommand("docker", ["rm", containerName]);

		logger.debug(
			{ projectId, containerName } as unknown as {
				projectId: string;
				containerName: string;
			},
			"Stopped and removed production container",
		);
	} catch (error) {
		// Container might not exist, that's okay
		logger.debug(
			{ projectId, error } as unknown as { projectId: string; error: unknown },
			"No existing production container to stop",
		);
	}
}
