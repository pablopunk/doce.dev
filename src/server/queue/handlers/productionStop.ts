import * as fs from "node:fs/promises";
import { logger } from "@/server/logger";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProductionPath } from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { spawnCommand } from "@/server/utils/execAsync";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

export async function handleProductionStop(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("production.stop", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		logger.warn(
			{ projectId: payload.projectId },
			"Project not found for production.stop",
		);
		return;
	}

	try {
		const containerName = `doce-prod-${project.id}`;

		logger.info(
			{ projectId: project.id, containerName },
			"Stopping production container",
		);

		await stopContainer(project.id, containerName);
		await removeContainer(project.id, containerName);
		await removeDockerImages(project.id);
		await removeProductionArtifacts(project.id);

		if (project.status !== "deleting") {
			await updateProductionStatus(project.id, "stopped");
		}

		logger.info({ projectId: project.id }, "Production cleanup complete");
	} catch (error) {
		logger.error(
			{ projectId: project.id, error },
			"production.stop handler failed",
		);
		throw error;
	}
}

async function stopContainer(
	projectId: string,
	containerName: string,
): Promise<void> {
	const result = await spawnCommand("docker", ["stop", containerName]);
	if (!result.success) {
		logger.warn(
			{ projectId, stderr: result.stderr.slice(0, 200) },
			"Failed to stop production container (may not exist)",
		);
	}
}

async function removeContainer(
	projectId: string,
	containerName: string,
): Promise<void> {
	const result = await spawnCommand("docker", ["rm", containerName]);
	if (!result.success) {
		logger.warn(
			{ projectId, stderr: result.stderr.slice(0, 200) },
			"Failed to remove production container (may not exist)",
		);
	}
}

async function removeDockerImages(projectId: string): Promise<void> {
	const imagePrefix = `doce-prod-${projectId}-`;
	try {
		const listResult = await spawnCommand("docker", [
			"images",
			imagePrefix,
			"--format",
			"{{.Repository}}:{{.Tag}}",
		]);

		if (!listResult.success || !listResult.stdout) return;

		const images = listResult.stdout.trim().split("\n").filter(Boolean);
		for (const image of images) {
			const rmiResult = await spawnCommand("docker", ["rmi", image]);
			if (rmiResult.success) {
				logger.debug({ projectId, image }, "Removed Docker image");
			}
		}
	} catch (error) {
		logger.debug(
			{ projectId, error },
			"Failed to remove Docker images (may not exist)",
		);
	}
}

async function removeProductionArtifacts(projectId: string): Promise<void> {
	const productionDir = getProductionPath(projectId);
	try {
		await fs.rm(productionDir, { recursive: true, force: true });
		logger.debug({ projectId, productionDir }, "Removed production artifacts");
	} catch (error) {
		logger.debug(
			{ projectId, error },
			"Failed to remove production artifacts (may not exist)",
		);
	}
}
