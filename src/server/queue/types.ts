import { z } from "zod";

export const queueJobTypeSchema = z.enum([
  "project.delete",
  "projects.deleteAllForUser",
  "docker.ensureRunning",
  "docker.stop",
]);

export type QueueJobType = z.infer<typeof queueJobTypeSchema>;

export const projectDeletePayloadSchema = z.object({
  projectId: z.string().min(1),
  requestedByUserId: z.string().min(1),
});

export type ProjectDeletePayload = z.infer<typeof projectDeletePayloadSchema>;

export const projectsDeleteAllForUserPayloadSchema = z.object({
  userId: z.string().min(1),
});

export type ProjectsDeleteAllForUserPayload = z.infer<
  typeof projectsDeleteAllForUserPayloadSchema
>;

export const dockerEnsureRunningPayloadSchema = z.object({
  projectId: z.string().min(1),
  reason: z.enum(["presence", "user"]).default("presence"),
});

export type DockerEnsureRunningPayload = z.infer<
  typeof dockerEnsureRunningPayloadSchema
>;

export const dockerStopPayloadSchema = z.object({
  projectId: z.string().min(1),
  reason: z.enum(["idle", "user"]).default("idle"),
});

export type DockerStopPayload = z.infer<typeof dockerStopPayloadSchema>;

const payloadSchemaByType = {
  "project.delete": projectDeletePayloadSchema,
  "projects.deleteAllForUser": projectsDeleteAllForUserPayloadSchema,
  "docker.ensureRunning": dockerEnsureRunningPayloadSchema,
  "docker.stop": dockerStopPayloadSchema,
} as const satisfies Record<QueueJobType, z.ZodTypeAny>;

export type PayloadByType = {
  "project.delete": ProjectDeletePayload;
  "projects.deleteAllForUser": ProjectsDeleteAllForUserPayload;
  "docker.ensureRunning": DockerEnsureRunningPayload;
  "docker.stop": DockerStopPayload;
};

export function parsePayload<T extends QueueJobType>(
  type: T,
  payloadJson: string
): PayloadByType[T] {
  const schema = payloadSchemaByType[type];
  const raw = JSON.parse(payloadJson) as unknown;
  return schema.parse(raw) as PayloadByType[T];
}
