import { z } from "zod";

export const queueJobTypeSchema = z.enum([
  // Project lifecycle
  "project.create",
  "project.delete",
  "projects.deleteAllForUser",
  // Docker lifecycle (fine-grained)
  "docker.composeUp",
  "docker.waitReady",
  "docker.ensureRunning", // legacy: kept for presence-driven starts
  "docker.stop",
  // Opencode bootstrap
  "opencode.sessionCreate",
  "opencode.sessionInit",
  "opencode.sendInitialPrompt", // legacy: kept for backward compatibility
  "opencode.sendUserPrompt",    // new: sends user's actual prompt
]);

export type QueueJobType = z.infer<typeof queueJobTypeSchema>;

// --- Payload schemas ---

export const projectCreatePayloadSchema = z.object({
  projectId: z.string().min(1),
  ownerUserId: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().nullable(),
});

export type ProjectCreatePayload = z.infer<typeof projectCreatePayloadSchema>;

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

export const dockerComposeUpPayloadSchema = z.object({
  projectId: z.string().min(1),
  reason: z.enum(["bootstrap", "presence"]).default("bootstrap"),
});

export type DockerComposeUpPayload = z.infer<typeof dockerComposeUpPayloadSchema>;

export const dockerWaitReadyPayloadSchema = z.object({
  projectId: z.string().min(1),
  startedAt: z.number(), // timestamp when we first started waiting
  rescheduleCount: z.number().default(0), // tracks how many times this job has been rescheduled
});

export type DockerWaitReadyPayload = z.infer<typeof dockerWaitReadyPayloadSchema>;

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

export const opencodeSessionCreatePayloadSchema = z.object({
  projectId: z.string().min(1),
});

export type OpencodeSessionCreatePayload = z.infer<typeof opencodeSessionCreatePayloadSchema>;

export const opencodeSessionInitPayloadSchema = z.object({
  projectId: z.string().min(1),
});

export type OpencodeSessionInitPayload = z.infer<typeof opencodeSessionInitPayloadSchema>;

export const opencodeSendInitialPromptPayloadSchema = z.object({
  projectId: z.string().min(1),
});

export type OpencodeSendInitialPromptPayload = z.infer<typeof opencodeSendInitialPromptPayloadSchema>;

export const opencodeSendUserPromptPayloadSchema = z.object({
  projectId: z.string().min(1),
});

export type OpencodeSendUserPromptPayload = z.infer<typeof opencodeSendUserPromptPayloadSchema>;

// --- Payload by type mapping ---

const payloadSchemaByType = {
  "project.create": projectCreatePayloadSchema,
  "project.delete": projectDeletePayloadSchema,
  "projects.deleteAllForUser": projectsDeleteAllForUserPayloadSchema,
  "docker.composeUp": dockerComposeUpPayloadSchema,
  "docker.waitReady": dockerWaitReadyPayloadSchema,
  "docker.ensureRunning": dockerEnsureRunningPayloadSchema,
  "docker.stop": dockerStopPayloadSchema,
  "opencode.sessionCreate": opencodeSessionCreatePayloadSchema,
  "opencode.sessionInit": opencodeSessionInitPayloadSchema,
  "opencode.sendInitialPrompt": opencodeSendInitialPromptPayloadSchema,
  "opencode.sendUserPrompt": opencodeSendUserPromptPayloadSchema,
} as const satisfies Record<QueueJobType, z.ZodTypeAny>;

export type PayloadByType = {
  "project.create": ProjectCreatePayload;
  "project.delete": ProjectDeletePayload;
  "projects.deleteAllForUser": ProjectsDeleteAllForUserPayload;
  "docker.composeUp": DockerComposeUpPayload;
  "docker.waitReady": DockerWaitReadyPayload;
  "docker.ensureRunning": DockerEnsureRunningPayload;
  "docker.stop": DockerStopPayload;
  "opencode.sessionCreate": OpencodeSessionCreatePayload;
  "opencode.sessionInit": OpencodeSessionInitPayload;
  "opencode.sendInitialPrompt": OpencodeSendInitialPromptPayload;
  "opencode.sendUserPrompt": OpencodeSendUserPromptPayload;
};

export function parsePayload<T extends QueueJobType>(
  type: T,
  payloadJson: string
): PayloadByType[T] {
  const schema = payloadSchemaByType[type];
  const raw = JSON.parse(payloadJson) as unknown;
  return schema.parse(raw) as PayloadByType[T];
}
