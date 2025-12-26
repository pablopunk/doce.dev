import { allocatePort } from "@/server/ports/allocate";
import { composeUpProduction } from "@/server/docker/compose";
import { logger } from "@/server/logger";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { enqueueProductionWaitReady } from "../enqueue";
import { getProductionPath, getTemplatePath } from "@/server/projects/paths";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import * as path from "node:path";
import { promises as fs } from "node:fs";
import type { Project } from "@/server/db/schema";

/**
 * Setup production directory with pre-built artifacts.
 * Copies dist/, public/, package.json, pnpm-lock.yaml, Dockerfile.prod, and docker-compose.production.yml.
 */
async function setupProductionDirectory(
	project: Project,
	productionPath: string,
	productionPort: number,
): Promise<void> {
	logger.info(
		{ projectId: project.id, productionPath },
		"Setting up production directory",
	);

	// Create production directory
	await fs.mkdir(productionPath, { recursive: true });

	// Create logs directory
	const logsDir = path.join(productionPath, "logs");
	await fs.mkdir(logsDir, { recursive: true });

	const projectPath = project.pathOnDisk;
	const templatePath = getTemplatePath();

	// Copy dist/ folder (required)
	const distSource = path.join(projectPath, "dist");
	const distDest = path.join(productionPath, "dist");
	try {
		await fs.cp(distSource, distDest, { recursive: true });
		logger.debug({ projectId: project.id }, "Copied dist/ folder");
	} catch (error) {
		logger.error(
			{ projectId: project.id, error },
			"Failed to copy dist/ folder (may not exist yet)",
		);
		// Don't throw - dist might not exist if build hasn't completed yet
	}

	// Copy public/ folder if it exists
	const publicSource = path.join(projectPath, "public");
	const publicDest = path.join(productionPath, "public");
	try {
		await fs.cp(publicSource, publicDest, { recursive: true });
		logger.debug({ projectId: project.id }, "Copied public/ folder");
	} catch (error) {
		// public/ folder might not exist, that's okay
		logger.debug(
			{ projectId: project.id },
			"public/ folder not found (optional)",
		);
	}

	// Copy package.json
	const pkgSource = path.join(projectPath, "package.json");
	const pkgDest = path.join(productionPath, "package.json");
	await fs.cp(pkgSource, pkgDest);
	logger.debug({ projectId: project.id }, "Copied package.json");

	// Copy pnpm-lock.yaml
	const lockSource = path.join(projectPath, "pnpm-lock.yaml");
	const lockDest = path.join(productionPath, "pnpm-lock.yaml");
	await fs.cp(lockSource, lockDest);
	logger.debug({ projectId: project.id }, "Copied pnpm-lock.yaml");

	// Copy Dockerfile.prod from template
	const dockerfileProdSource = path.join(templatePath, "Dockerfile.prod");
	const dockerfileProdDest = path.join(productionPath, "Dockerfile.prod");
	await fs.cp(dockerfileProdSource, dockerfileProdDest);
	logger.debug({ projectId: project.id }, "Copied Dockerfile.prod");

	// Copy docker-compose.production.yml from template
	const composeProdSource = path.join(
		templatePath,
		"docker-compose.production.yml",
	);
	const composeProdDest = path.join(
		productionPath,
		"docker-compose.production.yml",
	);
	await fs.cp(composeProdSource, composeProdDest);
	logger.debug(
		{ projectId: project.id },
		"Copied docker-compose.production.yml",
	);

	// Create .env with PRODUCTION_PORT
	const envPath = path.join(productionPath, ".env");
	const envContent = `NODE_ENV=production\nPRODUCTION_PORT=${productionPort}\n`;
	await fs.writeFile(envPath, envContent);
	logger.debug({ projectId: project.id }, "Created .env with PRODUCTION_PORT");

	logger.info(
		{ projectId: project.id, productionPath },
		"Production directory setup complete",
	);
}

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

	try {
		// Allocate production port
		const productionPort = await allocatePort();
		logger.info(
			{ projectId: project.id, productionPort },
			"Allocated production port",
		);

		await ctx.throwIfCancelRequested();

		// Setup production directory with pre-built artifacts
		const productionPath = getProductionPath(project.id);
		logger.info(
			{
				projectId: project.id,
				productionPath,
			},
			"Setting up production directory",
		);

		await setupProductionDirectory(project, productionPath, productionPort);

		await ctx.throwIfCancelRequested();

		// Start production container using docker compose
		// This will run: pnpm install --prod && pnpm run preview --host
		logger.info(
			{
				projectId: project.id,
				productionPath,
				productionPort,
			},
			"Calling composeUpProduction",
		);

		const result = await composeUpProduction(
			project.id,
			productionPath,
			productionPort,
		);

		logger.info(
			{
				projectId: project.id,
				success: result.success,
				exitCode: result.exitCode,
				stderrSlice: result.stderr.slice(0, 200),
			},
			"composeUpProduction result",
		);

		if (!result.success) {
			const errorMsg = `compose up failed: ${result.stderr.slice(0, 500)}`;
			await updateProductionStatus(project.id, "failed", {
				productionError: errorMsg,
			});
			throw new Error(errorMsg);
		}

		logger.info(
			{ projectId: project.id, productionPort },
			"Docker compose up succeeded for production",
		);

		// Update production status with port (status still "building" until waitReady confirms)
		await updateProductionStatus(project.id, "building", {
			productionPort,
			productionStartedAt: new Date(),
		});

		// Enqueue next step: wait for production server to be ready
		await enqueueProductionWaitReady({
			projectId: project.id,
			productionPort,
			startedAt: Date.now(),
			rescheduleCount: 0,
		});

		logger.debug(
			{ projectId: project.id, productionPort },
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
