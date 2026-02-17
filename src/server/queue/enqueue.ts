import { randomBytes } from "node:crypto";
import type { QueueJob } from "@/server/db/schema";
import { cancelEnsureRunningForProject, enqueueJob } from "./queue.model";
import type {
	DockerComposeUpPayload,
	DockerEnsureRunningPayload,
	DockerStopPayload,
	DockerWaitReadyPayload,
	OpencodeSendInitialPromptPayload,
	OpencodeSendUserPromptPayload,
	OpencodeSessionCreatePayload,
	ProductionBuildPayload,
	ProductionStartPayload,
	ProductionWaitReadyPayload,
	ProjectCreatePayload,
	ProjectDeletePayload,
	ProjectsDeleteAllForUserPayload,
} from "./types";

// --- Project lifecycle ---

export async function enqueueProjectCreate(
	input: ProjectCreatePayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "project.create",
		projectId: input.projectId,
		payload: input,
		dedupeKey: `project.create:${input.projectId}`,
	});
}

export async function enqueueProjectDelete(
	input: ProjectDeletePayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "project.delete",
		projectId: input.projectId,
		payload: input,
		dedupeKey: `project.delete:${input.projectId}`,
	});
}

export async function enqueueDeleteAllProjectsForUser(
	input: ProjectsDeleteAllForUserPayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "projects.deleteAllForUser",
		payload: input,
		dedupeKey: `projects.deleteAllForUser:${input.userId}`,
	});
}

// --- Docker lifecycle (fine-grained) ---

export async function enqueueDockerComposeUp(
	input: DockerComposeUpPayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "docker.composeUp",
		projectId: input.projectId,
		payload: input,
		dedupeKey: `docker.composeUp:${input.projectId}`,
	});
}

export async function enqueueDockerWaitReady(
	input: DockerWaitReadyPayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "docker.waitReady",
		projectId: input.projectId,
		payload: {
			...input,
			rescheduleCount: input.rescheduleCount ?? 0,
		},
		maxAttempts: 300, // Allow 300 reschedules * 1s poll interval = 5 minutes total
		// No dedupe - allow multiple waits if needed
	});
}

export async function enqueueDockerEnsureRunning(
	input: DockerEnsureRunningPayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "docker.ensureRunning",
		projectId: input.projectId,
		payload: input,
		dedupeKey: `docker.ensureRunning:${input.projectId}`,
	});
}

export async function enqueueDockerStop(
	input: DockerStopPayload,
): Promise<QueueJob> {
	// Cancel any conflicting ensureRunning jobs first
	await cancelEnsureRunningForProject(input.projectId);

	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "docker.stop",
		projectId: input.projectId,
		payload: input,
		dedupeKey: `docker.stop:${input.projectId}`,
	});
}

// --- Opencode bootstrap ---

export async function enqueueOpencodeSessionCreate(
	input: OpencodeSessionCreatePayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "opencode.sessionCreate",
		projectId: input.projectId,
		payload: input,
		dedupeKey: `opencode.sessionCreate:${input.projectId}`,
	});
}

export async function enqueueOpencodeSendInitialPrompt(
	input: OpencodeSendInitialPromptPayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "opencode.sendInitialPrompt",
		projectId: input.projectId,
		payload: input,
		dedupeKey: `opencode.sendInitialPrompt:${input.projectId}`,
	});
}

/**
 * Enqueue sending the user's actual prompt (the project prompt).
 * This is called after session.init completes.
 */
export async function enqueueOpencodeSendUserPrompt(
	input: OpencodeSendUserPromptPayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "opencode.sendUserPrompt",
		projectId: input.projectId,
		payload: input,
		dedupeKey: `opencode.sendUserPrompt:${input.projectId}`,
	});
}

// --- Production deployment ---

export async function enqueueProductionBuild(
	input: ProductionBuildPayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "production.build",
		projectId: input.projectId,
		payload: input,
		// Deploy-level dedupe: prevents duplicate deploys while build job is active
		dedupeKey: `production.deploy:${input.projectId}`,
	});
}

export async function enqueueProductionStart(
	input: ProductionStartPayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "production.start",
		projectId: input.projectId,
		payload: input,
		dedupeKey: `production.start:${input.projectId}`,
	});
}

export async function enqueueProductionWaitReady(
	input: ProductionWaitReadyPayload,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "production.waitReady",
		projectId: input.projectId,
		payload: {
			...input,
			rescheduleCount: input.rescheduleCount ?? 0,
		},
		maxAttempts: 300, // Allow 300 reschedules * 1s poll interval = 5 minutes total
		// No dedupe - allow multiple waits if needed
	});
}

export async function enqueueProductionStop(
	projectId: string,
): Promise<QueueJob> {
	return enqueueJob({
		id: randomBytes(16).toString("hex"),
		type: "production.stop",
		projectId,
		payload: { projectId },
		dedupeKey: `production.stop:${projectId}`,
	});
}
