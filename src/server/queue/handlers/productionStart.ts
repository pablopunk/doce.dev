import { logger } from "@/server/logger";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProductionPath } from "@/server/projects/paths";
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
			"-e",
			"PORT=3000",
			"-e",
			"HOST=0.0.0.0",
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

		await updateProductionStatus(project.id, "building", {
			productionStartedAt: new Date(),
			productionHash: payload.productionHash,
		});

		await enqueueProductionWaitReady({
			projectId: project.id,
			productionPort,
			productionHash: payload.productionHash,
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
