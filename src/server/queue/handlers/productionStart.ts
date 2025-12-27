import { promises as fs } from "node:fs";
import * as path from "node:path";
import type { Project } from "@/server/db/schema";
import { composeUpProduction } from "@/server/docker/compose";
import { logger } from "@/server/logger";
import { allocatePort } from "@/server/ports/allocate";
import { cleanupOldProductionVersions } from "@/server/productions/cleanup";
import { updateProductionStatus } from "@/server/productions/productions.model";
import {
	getProductionCurrentSymlink,
	getProductionPath,
	getTemplatePath,
} from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { enqueueProductionWaitReady } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

/**
 * Setup production directory with pre-built artifacts.
 * Creates a hash-versioned directory structure and updates the "current" symlink.
 * Copies dist/, public/, package.json, pnpm-lock.yaml, Dockerfile.prod, and docker-compose.production.yml.
 */
async function setupProductionDirectory(
	project: Project,
	productionPath: string,
	productionPort: number,
	productionHash: string,
): Promise<void> {
	logger.info(
		{ projectId: project.id, productionPath, productionHash },
		"Setting up production directory",
	);

	// Create hash-versioned production directory
	await fs.mkdir(productionPath, { recursive: true });

	// Create logs directory
	const logsDir = path.join(productionPath, "logs");
	await fs.mkdir(logsDir, { recursive: true });

	const projectPath = project.pathOnDisk;
	const templatePath = getTemplatePath();

	// Copy src/ folder (required for building in production)
	const srcSource = path.join(projectPath, "src");
	const srcDest = path.join(productionPath, "src");
	try {
		await fs.cp(srcSource, srcDest, { recursive: true });
		logger.debug({ projectId: project.id }, "Copied src/ folder");
	} catch (error) {
		logger.error(
			{ projectId: project.id, error },
			"Failed to copy src/ folder",
		);
		throw error;
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

	// Copy astro.config.mjs
	const astroConfigSource = path.join(projectPath, "astro.config.mjs");
	const astroConfigDest = path.join(productionPath, "astro.config.mjs");
	try {
		await fs.cp(astroConfigSource, astroConfigDest);
		logger.debug({ projectId: project.id }, "Copied astro.config.mjs");
	} catch (error) {
		logger.error(
			{ projectId: project.id, error },
			"Failed to copy astro.config.mjs",
		);
		throw error;
	}

	// Copy tsconfig.json
	const tsconfigSource = path.join(projectPath, "tsconfig.json");
	const tsconfigDest = path.join(productionPath, "tsconfig.json");
	try {
		await fs.cp(tsconfigSource, tsconfigDest);
		logger.debug({ projectId: project.id }, "Copied tsconfig.json");
	} catch (error) {
		logger.error(
			{ projectId: project.id, error },
			"Failed to copy tsconfig.json",
		);
		throw error;
	}

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
		const payload = parsePayload("production.start", ctx.job.payloadJson);

		// Allocate production port
		const productionPort = await allocatePort();
		logger.info(
			{ projectId: project.id, productionPort },
			"Allocated production port",
		);

		await ctx.throwIfCancelRequested();

		// Setup production directory with pre-built artifacts in hash-versioned path
		const productionPath = getProductionPath(
			project.id,
			payload.productionHash,
		);
		logger.info(
			{
				projectId: project.id,
				productionPath,
				productionHash: payload.productionHash,
			},
			"Setting up production directory",
		);

		await setupProductionDirectory(
			project,
			productionPath,
			productionPort,
			payload.productionHash,
		);

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
			payload.productionHash,
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

		// Atomically update the "current" symlink to point to the new hash directory
		// This ensures atomic deployment and enables rollback
		const symlinkPath = getProductionCurrentSymlink(project.id);
		const projectDir = getProductionPath(project.id);

		// Ensure project directory exists
		await fs.mkdir(projectDir, { recursive: true });

		// Create temporary symlink with a unique name for atomic rename
		const tempSymlink = `${symlinkPath}.tmp-${Date.now()}`;
		try {
			// Remove temp symlink if it exists (shouldn't, but be safe)
			await fs.unlink(tempSymlink).catch(() => {});

			// Create new symlink pointing to hash directory
			await fs.symlink(payload.productionHash, tempSymlink);

			// Atomically rename to final location (overwrites old symlink)
			await fs.rename(tempSymlink, symlinkPath);

			logger.debug(
				{
					projectId: project.id,
					symlinkPath,
					target: payload.productionHash,
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

		// Update production status with port and hash (status still "building" until waitReady confirms)
		await updateProductionStatus(project.id, "building", {
			productionPort,
			productionStartedAt: new Date(),
			productionHash: payload.productionHash,
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

		// Clean up old production versions in the background (keep last 2)
		// This is non-blocking - failures don't affect the deployment
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
