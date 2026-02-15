import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { hashDistFolder } from "@/server/productions/hash";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProjectProductionPath } from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { spawnCommand } from "@/server/utils/execAsync";
import { enqueueProductionStart } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

function getPreviewContainerName(projectId: string): string {
	return `doce_${projectId}-preview-1`;
}

export async function handleProductionBuild(
	ctx: QueueJobContext,
): Promise<void> {
	const payload = parsePayload("production.build", ctx.job.payloadJson);

	const project = await getProjectByIdIncludeDeleted(payload.projectId);
	if (!project) {
		logger.warn(
			{ projectId: payload.projectId },
			"Project not found for production.build",
		);
		return;
	}

	if (project.status === "deleting") {
		logger.info(
			{ projectId: project.id },
			"Skipping production.build for deleting project",
		);
		return;
	}
	await updateProductionStatus(project.id, "building");

	await ctx.throwIfCancelRequested();

	const containerName = getPreviewContainerName(project.id);
	logger.info(
		{ projectId: project.id, containerName },
		"Starting production build inside preview container",
	);

	const result = await spawnCommand(
		"docker",
		["exec", containerName, "pnpm", "run", "build"],
		{ timeout: 5 * 60 * 1000 },
	);

	if (!result.success) {
		const errorMsg = result.stderr || result.stdout || "Build failed";
		logger.error(
			{ projectId: project.id, error: errorMsg.slice(0, 500) },
			"Production build failed",
		);
		await updateProductionStatus(project.id, "failed", {
			productionError: errorMsg.slice(0, 500),
		});
		throw new Error(`Build failed: ${errorMsg.slice(0, 200)}`);
	}

	logger.info({ projectId: project.id }, "Production build succeeded");

	const tempDistPath = path.join(
		os.tmpdir(),
		`doce-dist-${project.id}-${Date.now()}`,
	);

	try {
		const productionHash = await extractAndHashDist(
			containerName,
			tempDistPath,
			project.id,
		);

		await ctx.throwIfCancelRequested();
		const productionPath = getProjectProductionPath(project.id, productionHash);
		await fs.mkdir(productionPath, { recursive: true });

		await extractFilesFromContainer(containerName, productionPath, project.id);

		logger.debug(
			{ projectId: project.id, productionHash, productionPath },
			"Production version files copied",
		);

		await enqueueProductionStart({
			projectId: project.id,
			productionHash,
		});

		logger.debug(
			{ projectId: project.id, productionHash },
			"Enqueued production.start",
		);
	} finally {
		await fs.rm(tempDistPath, { recursive: true, force: true }).catch(() => {});
	}
}

async function extractAndHashDist(
	containerName: string,
	tempDistPath: string,
	projectId: string,
): Promise<string> {
	await fs.rm(tempDistPath, { recursive: true, force: true });

	const cpResult = await spawnCommand("docker", [
		"cp",
		`${containerName}:/app/dist`,
		tempDistPath,
	]);

	if (!cpResult.success) {
		throw new Error(
			`Failed to extract dist from container: ${cpResult.stderr}`,
		);
	}

	const productionHash = await hashDistFolder(tempDistPath);
	logger.debug({ projectId, productionHash }, "Calculated production hash");
	return productionHash;
}

async function extractFilesFromContainer(
	containerName: string,
	productionPath: string,
	projectId: string,
): Promise<void> {
	const files = [
		"package.json",
		"pnpm-lock.yaml",
		"Dockerfile.prod",
		"astro.config.mjs",
		"tsconfig.json",
	];

	for (const file of files) {
		const result = await spawnCommand("docker", [
			"cp",
			`${containerName}:/app/${file}`,
			path.join(productionPath, file),
		]);
		if (!result.success) {
			throw new Error(
				`Failed to extract ${file} from container: ${result.stderr}`,
			);
		}
	}

	const srcResult = await spawnCommand("docker", [
		"cp",
		`${containerName}:/app/src`,
		path.join(productionPath, "src"),
	]);
	if (!srcResult.success) {
		throw new Error(
			`Failed to extract src from container: ${srcResult.stderr}`,
		);
	}

	const publicResult = await spawnCommand("docker", [
		"cp",
		`${containerName}:/app/public`,
		path.join(productionPath, "public"),
	]);
	if (!publicResult.success) {
		logger.debug({ projectId }, "public folder not found (optional)");
	}
}
