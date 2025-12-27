import { execSync } from "node:child_process";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { hashDistFolder } from "@/server/productions/hash";
import { updateProductionStatus } from "@/server/productions/productions.model";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
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

	try {
		await updateProductionStatus(project.id, "building");

		await ctx.throwIfCancelRequested();

		logger.info({ projectId: project.id }, "Starting production build");

		// Run pnpm run build in the project directory
		// This creates the dist/ folder that will be used by the production container
		try {
			execSync("pnpm run build", {
				cwd: project.pathOnDisk,
				stdio: "pipe",
				timeout: 5 * 60 * 1000, // 5 minute timeout
			});
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
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
		const distPath = path.join(project.pathOnDisk, "dist");
		const productionHash = await hashDistFolder(distPath);
		logger.debug(
			{ projectId: project.id, productionHash },
			"Calculated production hash",
		);

		// Enqueue next step: start production container with hash
		// Port will be allocated by the production.start handler
		await enqueueProductionStart({
			projectId: project.id,
			productionHash,
		});

		logger.debug(
			{ projectId: project.id, productionHash },
			"Enqueued production.start",
		);
	} catch (error) {
		throw error;
	}
}
