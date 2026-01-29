import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { hashDistFolder } from "@/server/productions/hash";
import { updateProductionStatus } from "@/server/productions/productions.model";
import {
	getProjectPreviewPath,
	getProjectProductionPath,
} from "@/server/projects/paths";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { spawnCommand } from "@/server/utils/execAsync";
import { enqueueProductionStart } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

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

	logger.info({ projectId: project.id }, "Starting production build");

	// Run pnpm run build in the preview/src/ directory
	const previewPath = getProjectPreviewPath(project.id);
	const srcPath = path.join(previewPath, "src");

	const result = await spawnCommand("pnpm", ["run", "build"], {
		cwd: srcPath,
		timeout: 5 * 60 * 1000, // 5 minute timeout
	});

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

	// Calculate hash of dist folder for atomic versioned deployment
	const distPath = path.join(previewPath, "dist");
	const productionHash = await hashDistFolder(distPath);
	logger.debug(
		{ projectId: project.id, productionHash },
		"Calculated production hash",
	);

	// Create production/{hash}/ directory and copy files
	await ctx.throwIfCancelRequested();
	const productionPath = getProjectProductionPath(project.id, productionHash);
	await fs.mkdir(productionPath, { recursive: true });

	// Copy all required files for production build
	await copyRequiredFiles(previewPath, productionPath, project.id);

	logger.debug(
		{ projectId: project.id, productionHash, productionPath },
		"Production version files copied",
	);

	// Enqueue next step: start production container with hash
	await enqueueProductionStart({
		projectId: project.id,
		productionHash,
	});

	logger.debug(
		{ projectId: project.id, productionHash },
		"Enqueued production.start",
	);
}

/**
 * Copy all required files from preview to production directory.
 */
async function copyRequiredFiles(
	previewPath: string,
	productionPath: string,
	projectId: string,
): Promise<void> {
	// Core files
	await fs.copyFile(
		path.join(previewPath, "package.json"),
		path.join(productionPath, "package.json"),
	);
	await fs.copyFile(
		path.join(previewPath, "pnpm-lock.yaml"),
		path.join(productionPath, "pnpm-lock.yaml"),
	);

	// Docker build files (required by Dockerfile.prod)
	await fs.copyFile(
		path.join(previewPath, "Dockerfile.prod"),
		path.join(productionPath, "Dockerfile.prod"),
	);

	// Config files (required by Dockerfile.prod for build stage)
	await fs.copyFile(
		path.join(previewPath, "astro.config.mjs"),
		path.join(productionPath, "astro.config.mjs"),
	);
	await fs.copyFile(
		path.join(previewPath, "tsconfig.json"),
		path.join(productionPath, "tsconfig.json"),
	);

	// Source code (required by Dockerfile.prod for build stage)
	await fs.cp(path.join(previewPath, "src"), path.join(productionPath, "src"), {
		recursive: true,
	});

	// Public folder (optional - might contain assets)
	try {
		await fs.cp(
			path.join(previewPath, "public"),
			path.join(productionPath, "public"),
			{ recursive: true },
		);
	} catch (error) {
		// public folder might not exist, that's okay
		logger.debug({ projectId }, "public folder not found (optional)");
	}
}
