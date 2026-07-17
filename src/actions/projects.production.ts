import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";
import {
	enqueueProductionBuild,
	enqueueProductionStop,
} from "@/server/queue/enqueue";

export const deploy = defineAction({
	input: z.object({
		projectId: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to deploy a project",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		const project = await getProjectById(input.projectId);
		if (!project) {
			throw new ActionError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		if (
			project.desiredStatus !== "running" ||
			project.observedStatus !== "healthy"
		) {
			throw new ActionError({
				code: "BAD_REQUEST",
				message: `Cannot deploy project while desired=${project.desiredStatus} and observed=${project.observedStatus}`,
			});
		}

		const { hasActiveDeployment, updateProductionStatus } = await import(
			"@/server/productions/productions.model"
		);
		if (await hasActiveDeployment(input.projectId)) {
			throw new ActionError({
				code: "CONFLICT",
				message: "A deployment is already in progress",
			});
		}

		const job = await enqueueProductionBuild({
			projectId: input.projectId,
		});

		await updateProductionStatus(input.projectId, "queued", {
			productionError: null,
		});

		return { success: true, jobId: job.id };
	},
});

export const stopProduction = defineAction({
	input: z.object({
		projectId: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in to stop production",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		const project = await getProjectById(input.projectId);
		if (!project) {
			throw new ActionError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		const { cancelActiveProductionJobs } = await import(
			"@/server/productions/productions.model"
		);
		await cancelActiveProductionJobs(input.projectId);

		const job = await enqueueProductionStop(input.projectId);

		return { success: true, jobId: job.id };
	},
});

export const rollback = defineAction({
	input: z.object({
		projectId: z.string(),
		toHash: z.string(),
	}),
	handler: async (input, context) => {
		const user = context.locals.user;
		if (!user) {
			throw new ActionError({
				code: "UNAUTHORIZED",
				message: "You must be logged in",
			});
		}

		const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
		if (!isOwner) {
			throw new ActionError({
				code: "FORBIDDEN",
				message: "You don't have access to this project",
			});
		}

		const project = await getProjectById(input.projectId);
		if (!project) {
			throw new ActionError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		const { getProductionVersions } = await import(
			"@/server/productions/cleanup"
		);
		const { getProductionPath } = await import("@/server/projects/paths");
		const { updateProductionStatus } = await import(
			"@/server/productions/productions.model"
		);

		const versions = await getProductionVersions(input.projectId);
		const targetVersion = versions.find((v) => v.hash === input.toHash);

		if (!targetVersion) {
			throw new ActionError({
				code: "NOT_FOUND",
				message: "Target version not found",
			});
		}

		if (targetVersion.isActive) {
			throw new ActionError({
				code: "BAD_REQUEST",
				message: "Target version is already active",
			});
		}

		const productionPort = project.productionPort;
		if (!productionPort) {
			throw new ActionError({
				code: "BAD_REQUEST",
				message: "Project not initialized for production",
			});
		}

		// Build Docker image for rollback version
		const productionPath = getProductionPath(project.id, input.toHash);
		const { getProductionContainerName, getProductionImageName } = await import(
			"@/server/projects/paths"
		);
		const imageName = getProductionImageName(project.id, input.toHash);

		const { spawnCommand } = await import("@/server/utils/execAsync");
		const buildResult = await spawnCommand(
			"docker",
			["build", "-t", imageName, "-f", "Dockerfile.prod", "."],
			{ cwd: productionPath },
		);

		if (!buildResult.success) {
			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message: `Docker build failed: ${buildResult.stderr.slice(0, 200)}`,
			});
		}

		// Stop and remove old container
		const containerName = getProductionContainerName(project.id);
		const stopResult = await spawnCommand("docker", ["stop", containerName]);
		const removeResult = await spawnCommand("docker", ["rm", containerName]);

		if (!stopResult.success || !removeResult.success) {
			// Container might not exist, continue
		}

		// Start new container
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
			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message: `Docker run failed: ${runResult.stderr.slice(0, 200)}`,
			});
		}

		// Update symlink
		const { getProductionCurrentSymlink } = await import(
			"@/server/projects/paths"
		);
		const symlinkPath = getProductionCurrentSymlink(project.id);
		const hashPath = getProductionPath(project.id, input.toHash);
		const tempSymlink = `${symlinkPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		const fs = await import("node:fs/promises");
		try {
			await fs.unlink(tempSymlink).catch(() => {});
			await fs.symlink(hashPath, tempSymlink);
			await fs.rename(tempSymlink, symlinkPath);
		} catch {
			// Symlink update failed, but container is running
		}

		const { getCanonicalProductionUrl } = await import(
			"@/server/productions/productionUrl"
		);
		await updateProductionStatus(input.projectId, "running", {
			productionHash: input.toHash,
			productionStartedAt: new Date(),
			productionUrl: await getCanonicalProductionUrl(project),
		});

		return { success: true };
	},
});
