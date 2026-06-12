import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	getProjectById,
	isProjectOwnedByUser,
	markUserPromptCompleted,
} from "@/server/projects/projects.model";
import {
	getQueueJobDerivedError,
	getQueueJobDerivedState,
} from "@/server/queue/job-state";

export const getQueueStatus = defineAction({
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
			"docker.ensureRunning",
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
			state: "pending" | (typeof jobs)[number]["state"] | "exhausted";
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

		const projectCreateJob = jobsByType.get("project.create");
		const dockerComposeUpJob = jobsByType.get("docker.composeUp");
		const dockerEnsureRunningJob = jobsByType.get("docker.ensureRunning");
		const dockerWaitReadyJob = jobsByType.get("docker.waitReady");
		const sessionCreateJob = jobsByType.get("opencode.sessionCreate");
		const sendPromptJob = jobsByType.get("opencode.sendUserPrompt");

		for (const jobType of SETUP_JOBS) {
			const job = jobsByType.get(jobType);
			if (!job) {
				setupJobs[jobType] = { type: jobType, state: "pending" };
				isSetupComplete = false;
			} else {
				const derivedState = getQueueJobDerivedState(job);
				const derivedError = getQueueJobDerivedError(job);
				const isTerminalErrorState =
					derivedState === "failed" || derivedState === "exhausted";

				setupJobs[jobType] = {
					type: jobType,
					state: derivedState,
					...(derivedError ? { error: derivedError } : {}),
					completedAt: job.updatedAt.getTime(),
					createdAt: job.createdAt.getTime(),
				};
				if (isTerminalErrorState) {
					// docker.ensureRunning replaces docker.composeUp + docker.waitReady,
					// so suppress their errors when ensureRunning is active or succeeded
					const ensureRunningState = dockerEnsureRunningJob?.state;
					const ensureRunningActive =
						ensureRunningState === "queued" ||
						ensureRunningState === "running" ||
						ensureRunningState === "succeeded";
					const isRecoveredByEnsureRunning =
						(jobType === "docker.composeUp" ||
							jobType === "docker.waitReady") &&
						ensureRunningActive;
					if (!isRecoveredByEnsureRunning) {
						hasError = true;
						errorMessage =
							derivedError ||
							(derivedState === "exhausted"
								? `${jobType} exhausted all retry attempts`
								: `${jobType} failed`);
						isSetupComplete = false;
					}
				}
				if (jobType === "opencode.sendUserPrompt") {
					promptSentAt = job.updatedAt.getTime();
				}
			}
		}

		const dockerJob =
			dockerComposeUpJob?.state === "succeeded"
				? dockerComposeUpJob
				: dockerEnsureRunningJob?.state === "succeeded"
					? dockerEnsureRunningJob
					: dockerComposeUpJob || dockerEnsureRunningJob;

		// docker.ensureRunning does its own health checking internally,
		// so treat docker.waitReady as implicitly done when ensureRunning succeeded
		const dockerWaitDone =
			dockerWaitReadyJob?.state === "succeeded" ||
			dockerEnsureRunningJob?.state === "succeeded";

		let currentStep = 0;
		if (
			projectCreateJob?.state === "succeeded" &&
			dockerJob?.state === "succeeded" &&
			dockerWaitDone &&
			sessionCreateJob?.state === "succeeded" &&
			sendPromptJob?.state === "succeeded"
		) {
			currentStep = 4;
		} else if (
			projectCreateJob?.state === "succeeded" &&
			dockerJob?.state === "succeeded" &&
			dockerWaitDone &&
			sessionCreateJob?.state === "succeeded"
		) {
			currentStep = 3;
			isSetupComplete = false;
		} else if (
			projectCreateJob?.state === "succeeded" &&
			dockerJob?.state === "succeeded" &&
			dockerWaitDone
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
});
