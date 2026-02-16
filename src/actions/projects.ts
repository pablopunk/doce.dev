import { ActionError, defineAction } from "astro:actions";
import { randomBytes } from "node:crypto";
import { z } from "astro/zod";
import { listConnectedProviderIds } from "@/server/opencode/authFile";

import {
	getProjectById,
	getProjectsByUserId,
	isProjectOwnedByUser,
	markInitialPromptCompleted,
	markInitialPromptSent,
	markUserPromptCompleted,
	updateOpencodeJsonModel,
	updateProjectModel,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import {
	enqueueDeleteAllProjectsForUser,
	enqueueDockerStop,
	enqueueProductionBuild,
	enqueueProductionStop,
	enqueueProjectCreate,
	enqueueProjectDelete,
} from "@/server/queue/enqueue";

export const projects = {
	create: defineAction({
		accept: "json",
		input: z.object({
			prompt: z.string().min(1, "Please describe your website"),
			model: z.string().optional(),
			images: z.string().optional(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to create a project",
				});
			}

			const connectedProviderIds = await listConnectedProviderIds();
			if (connectedProviderIds.length === 0) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Please connect at least one provider in Settings",
				});
			}

			let images:
				| Array<{ filename: string; mime: string; dataUrl: string }>
				| undefined;
			if (input.images) {
				try {
					images = JSON.parse(input.images);
				} catch {}
			}

			const projectId = randomBytes(12).toString("hex");

			try {
				await enqueueProjectCreate({
					projectId,
					ownerUserId: user.id,
					prompt: input.prompt,
					model: input.model ?? null,
					images,
				});
			} catch (err) {
				console.error("Failed to enqueue project creation:", err);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to start project creation",
				});
			}

			return {
				success: true,
				projectId,
			};
		},
	}),

	list: defineAction({
		handler: async (_input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to list projects",
				});
			}

			const projects = await getProjectsByUserId(user.id);
			return { projects };
		},
	}),

	get: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to view a project",
				});
			}

			const project = await getProjectById(input.projectId);
			if (!project) {
				throw new ActionError({
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			if (project.ownerUserId !== user.id) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			return { project };
		},
	}),

	delete: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to delete a project",
				});
			}

			const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
			if (!isOwner) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			try {
				await updateProjectStatus(input.projectId, "deleting");
			} catch {}

			try {
				const { cancelActiveProductionJobs } = await import(
					"@/server/productions/productions.model"
				);
				await cancelActiveProductionJobs(input.projectId);
			} catch {}

			const job = await enqueueProjectDelete({
				projectId: input.projectId,
				requestedByUserId: user.id,
			});

			return { success: true, jobId: job.id };
		},
	}),

	stop: defineAction({
		input: z.object({
			projectId: z.string(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to stop a project",
				});
			}

			const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
			if (!isOwner) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			const job = await enqueueDockerStop({
				projectId: input.projectId,
				reason: "user",
			});

			return { success: true, jobId: job.id };
		},
	}),

	deploy: defineAction({
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

			if (project.status !== "running") {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: `Cannot deploy project while it's ${project.status}`,
				});
			}

			const { hasActiveDeployment } = await import(
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

			return { success: true, jobId: job.id };
		},
	}),

	stopProduction: defineAction({
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
	}),

	deleteAll: defineAction({
		handler: async (_input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to delete projects",
				});
			}

			const job = await enqueueDeleteAllProjectsForUser({ userId: user.id });

			return { success: true, jobId: job.id };
		},
	}),

	updateModel: defineAction({
		input: z.object({
			projectId: z.string(),
			model: z.string().nullable(),
		}),
		handler: async (input, context) => {
			const user = context.locals.user;
			if (!user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "You must be logged in to update a project",
				});
			}

			const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
			if (!isOwner) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			await updateProjectModel(input.projectId, input.model);

			if (input.model) {
				try {
					await updateOpencodeJsonModel(input.projectId, input.model);
				} catch (_error) {
					console.warn(
						"Updated model in database but failed to update opencode.json.",
					);
				}
			}

			return { success: true };
		},
	}),

	presence: defineAction({
		input: z.object({
			projectId: z.string(),
			viewerId: z.string(),
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
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			const { handlePresenceHeartbeat } = await import(
				"@/server/presence/manager"
			);
			return await handlePresenceHeartbeat(input.projectId, input.viewerId);
		},
	}),

	rollback: defineAction({
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
			const imageName = `doce-prod-${project.id}-${input.toHash}`;

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
			const containerName = `doce-prod-${project.id}`;
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

			await updateProductionStatus(input.projectId, "running", {
				productionHash: input.toHash,
				productionStartedAt: new Date(),
			});

			return { success: true };
		},
	}),

	markInitialPromptSent: defineAction({
		input: z.object({
			projectId: z.string(),
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

			await markInitialPromptSent(input.projectId);
			return { success: true };
		},
	}),

	markInitialPromptCompleted: defineAction({
		input: z.object({
			projectId: z.string(),
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

			await markInitialPromptCompleted(input.projectId);
			return { success: true };
		},
	}),

	getQueueStatus: defineAction({
		input: z.object({
			projectId: z.string(),
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
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			const project = await getProjectById(input.projectId);
			if (!project) {
				throw new ActionError({
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			const { listJobs } = await import("@/server/queue/queue.model");

			const SETUP_JOBS = [
				"project.create",
				"docker.composeUp",
				"docker.waitReady",
				"opencode.sessionCreate",
				"opencode.sendUserPrompt",
			] as const;

			const LEGACY_SEND_PROMPT_JOB = "opencode.sendInitialPrompt";
			const JOB_TIMEOUT_MS = 5 * 60 * 1000;

			const jobs = await listJobs({
				projectId: input.projectId,
				limit: 100,
			});

			type SetupJob = {
				type: string;
				state: "pending" | (typeof jobs)[number]["state"];
				error?: string;
				completedAt?: number;
				createdAt?: number;
			};

			const jobsByType = new Map<string, (typeof jobs)[0]>();
			for (const job of jobs) {
				if (
					SETUP_JOBS.includes(job.type as (typeof SETUP_JOBS)[number]) &&
					!jobsByType.has(job.type)
				) {
					jobsByType.set(job.type, job);
				}
				if (
					job.type === LEGACY_SEND_PROMPT_JOB &&
					!jobsByType.has("opencode.sendUserPrompt")
				) {
					jobsByType.set("opencode.sendUserPrompt", job);
				}
			}

			const setupJobs: Record<string, SetupJob> = {};
			let hasError = false;
			let errorMessage: string | undefined;
			let promptSentAt: number | undefined;
			let isSetupComplete = true;

			for (const jobType of SETUP_JOBS) {
				const job = jobsByType.get(jobType);
				if (!job) {
					setupJobs[jobType] = { type: jobType, state: "pending" };
					isSetupComplete = false;
				} else {
					setupJobs[jobType] = {
						type: jobType,
						state: job.state,
						...(job.lastError ? { error: job.lastError } : {}),
						completedAt: job.updatedAt.getTime(),
						createdAt: job.createdAt.getTime(),
					};
					if (job.state === "failed") {
						hasError = true;
						errorMessage = job.lastError || `${jobType} failed`;
						isSetupComplete = false;
					}
					if (jobType === "opencode.sendUserPrompt") {
						promptSentAt = job.updatedAt.getTime();
					}
				}
			}

			const projectCreateJob = jobsByType.get("project.create");
			const dockerComposeUpJob = jobsByType.get("docker.composeUp");
			const dockerWaitReadyJob = jobsByType.get("docker.waitReady");
			const sessionCreateJob = jobsByType.get("opencode.sessionCreate");
			const sendPromptJob = jobsByType.get("opencode.sendUserPrompt");

			let currentStep = 0;
			if (
				projectCreateJob?.state === "succeeded" &&
				dockerComposeUpJob?.state === "succeeded" &&
				dockerWaitReadyJob?.state === "succeeded" &&
				sessionCreateJob?.state === "succeeded" &&
				sendPromptJob?.state === "succeeded"
			) {
				currentStep = 4;
			} else if (
				projectCreateJob?.state === "succeeded" &&
				dockerComposeUpJob?.state === "succeeded" &&
				dockerWaitReadyJob?.state === "succeeded" &&
				sessionCreateJob?.state === "succeeded"
			) {
				currentStep = 3;
				isSetupComplete = false;
			} else if (
				projectCreateJob?.state === "succeeded" &&
				dockerComposeUpJob?.state === "succeeded" &&
				dockerWaitReadyJob?.state === "succeeded"
			) {
				currentStep = 2;
				isSetupComplete = false;
			} else if (projectCreateJob?.state === "succeeded") {
				currentStep = 1;
				isSetupComplete = false;
			}

			if (
				currentStep === 4 &&
				project.initialPromptSent &&
				!project.userPromptCompleted
			) {
				await markUserPromptCompleted(input.projectId);
			}

			let jobTimeoutWarning: string | undefined;
			const now = Date.now();
			for (const jobType of SETUP_JOBS) {
				const job = jobsByType.get(jobType);
				if (job && (job.state === "running" || job.state === "queued")) {
					const elapsed = now - job.createdAt.getTime();
					if (elapsed > JOB_TIMEOUT_MS) {
						jobTimeoutWarning = `${jobType} has been running for too long`;
						break;
					}
				}
			}

			return {
				projectId: input.projectId,
				currentStep,
				setupJobs,
				hasError,
				errorMessage,
				isSetupComplete,
				promptSentAt,
				jobTimeoutWarning,
			};
		},
	}),

	getProductionStatus: defineAction({
		input: z.object({
			projectId: z.string(),
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

			const { getProductionStatus, getActiveProductionJob } = await import(
				"@/server/productions/productions.model"
			);

			const status = getProductionStatus(project);
			const activeJob = await getActiveProductionJob(input.projectId);
			const productionPort = project.productionPort;
			const url = productionPort ? `http://localhost:${productionPort}` : null;

			return {
				status: status.status,
				url,
				productionPort,
				port: status.port,
				error: status.error,
				startedAt: status.startedAt?.toISOString() || null,
				activeJob: activeJob
					? {
							type: activeJob.type,
							state: activeJob.state,
						}
					: null,
			};
		},
	}),

	getProductionHistory: defineAction({
		input: z.object({
			projectId: z.string(),
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

			const versions = await getProductionVersions(input.projectId);
			const productionPort = project.productionPort;

			return {
				productionPort,
				baseUrl: productionPort ? `http://localhost:${productionPort}` : null,
				versions: versions.map((v) => {
					return {
						hash: v.hash,
						isActive: v.isActive,
						createdAt: v.mtimeIso,
						url:
							v.isActive && productionPort
								? `http://localhost:${productionPort}`
								: undefined,
						productionPort,
					};
				}),
			};
		},
	}),
};
