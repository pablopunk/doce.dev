import { randomBytes } from "node:crypto";
import type { QueueJob } from "@/server/db/schema";
import { enqueueJob } from "./queue.model";
import type {
  ProjectCreatePayload,
  ProjectDeletePayload,
  ProjectsDeleteAllForUserPayload,
  DockerComposeUpPayload,
  DockerWaitReadyPayload,
  DockerEnsureRunningPayload,
  DockerStopPayload,
  OpencodeSessionCreatePayload,
  OpencodeSendInitialPromptPayload,
  OpencodeWaitIdlePayload,
} from "./types";

// --- Project lifecycle ---

export async function enqueueProjectCreate(
  input: ProjectCreatePayload
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
  input: ProjectDeletePayload
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
  input: ProjectsDeleteAllForUserPayload
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
  input: DockerComposeUpPayload
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
  input: DockerWaitReadyPayload
): Promise<QueueJob> {
  return enqueueJob({
    id: randomBytes(16).toString("hex"),
    type: "docker.waitReady",
    projectId: input.projectId,
    payload: input,
    // No dedupe - allow multiple waits if needed
  });
}

export async function enqueueDockerEnsureRunning(
  input: DockerEnsureRunningPayload
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
  input: DockerStopPayload
): Promise<QueueJob> {
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
  input: OpencodeSessionCreatePayload
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
  input: OpencodeSendInitialPromptPayload
): Promise<QueueJob> {
  return enqueueJob({
    id: randomBytes(16).toString("hex"),
    type: "opencode.sendInitialPrompt",
    projectId: input.projectId,
    payload: input,
    dedupeKey: `opencode.sendInitialPrompt:${input.projectId}`,
  });
}

export async function enqueueOpencodeWaitIdle(
  input: OpencodeWaitIdlePayload
): Promise<QueueJob> {
  return enqueueJob({
    id: randomBytes(16).toString("hex"),
    type: "opencode.waitIdle",
    projectId: input.projectId,
    payload: input,
    // No dedupe - allow multiple waits
  });
}
