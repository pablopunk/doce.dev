import { randomBytes } from "node:crypto";
import type { QueueJob } from "@/server/db/schema";
import { enqueueJob } from "./queue.model";
import type {
  DockerEnsureRunningPayload,
  DockerStopPayload,
  ProjectDeletePayload,
  ProjectsDeleteAllForUserPayload,
} from "./types";

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

export async function enqueueDockerStop(input: DockerStopPayload): Promise<QueueJob> {
  return enqueueJob({
    id: randomBytes(16).toString("hex"),
    type: "docker.stop",
    projectId: input.projectId,
    payload: input,
    dedupeKey: `docker.stop:${input.projectId}`,
  });
}
