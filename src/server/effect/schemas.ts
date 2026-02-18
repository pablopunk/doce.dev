import { Schema } from "effect";

export const QueueJobType = Schema.Literal(
	"project.create",
	"project.delete",
	"projects.deleteAllForUser",
	"docker.composeUp",
	"docker.waitReady",
	"docker.ensureRunning",
	"docker.stop",
	"opencode.sessionCreate",
	"opencode.sendInitialPrompt",
	"opencode.sendUserPrompt",
	"production.build",
	"production.start",
	"production.waitReady",
	"production.stop",
);

export type QueueJobType = Schema.Schema.Type<typeof QueueJobType>;

export const ImageAttachment = Schema.Struct({
	filename: Schema.String,
	mime: Schema.String,
	dataUrl: Schema.String,
});

export type ImageAttachment = Schema.Schema.Type<typeof ImageAttachment>;

export const ProjectCreatePayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
	ownerUserId: Schema.String.pipe(Schema.minLength(1)),
	prompt: Schema.String.pipe(Schema.minLength(1)),
	model: Schema.NullOr(Schema.String),
	images: Schema.optional(Schema.Array(ImageAttachment)),
});

export type ProjectCreatePayload = Schema.Schema.Type<
	typeof ProjectCreatePayload
>;

export const ProjectDeletePayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
	requestedByUserId: Schema.String.pipe(Schema.minLength(1)),
});

export type ProjectDeletePayload = Schema.Schema.Type<
	typeof ProjectDeletePayload
>;

export const ProjectsDeleteAllForUserPayload = Schema.Struct({
	userId: Schema.String.pipe(Schema.minLength(1)),
});

export type ProjectsDeleteAllForUserPayload = Schema.Schema.Type<
	typeof ProjectsDeleteAllForUserPayload
>;

export const DockerComposeUpPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
	reason: Schema.optional(Schema.Literal("bootstrap", "presence")).pipe(
		Schema.withConstructorDefault(() => "bootstrap" as const),
	),
});

export type DockerComposeUpPayload = Schema.Schema.Type<
	typeof DockerComposeUpPayload
>;

export const DockerWaitReadyPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
	startedAt: Schema.Number,
	rescheduleCount: Schema.optional(Schema.Number).pipe(
		Schema.withConstructorDefault(() => 0),
	),
});

export type DockerWaitReadyPayload = Schema.Schema.Type<
	typeof DockerWaitReadyPayload
>;

export const DockerEnsureRunningPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
	reason: Schema.optional(Schema.Literal("presence", "user")).pipe(
		Schema.withConstructorDefault(() => "presence" as const),
	),
});

export type DockerEnsureRunningPayload = Schema.Schema.Type<
	typeof DockerEnsureRunningPayload
>;

export const DockerStopPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
	reason: Schema.optional(Schema.Literal("idle", "user")).pipe(
		Schema.withConstructorDefault(() => "idle" as const),
	),
});

export type DockerStopPayload = Schema.Schema.Type<typeof DockerStopPayload>;

export const OpencodeSessionCreatePayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
});

export type OpencodeSessionCreatePayload = Schema.Schema.Type<
	typeof OpencodeSessionCreatePayload
>;

export const OpencodeSendInitialPromptPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
});

export type OpencodeSendInitialPromptPayload = Schema.Schema.Type<
	typeof OpencodeSendInitialPromptPayload
>;

export const OpencodeSendUserPromptPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
});

export type OpencodeSendUserPromptPayload = Schema.Schema.Type<
	typeof OpencodeSendUserPromptPayload
>;

export const ProductionBuildPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
});

export type ProductionBuildPayload = Schema.Schema.Type<
	typeof ProductionBuildPayload
>;

export const ProductionStartPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
	productionHash: Schema.String.pipe(Schema.minLength(1)),
});

export type ProductionStartPayload = Schema.Schema.Type<
	typeof ProductionStartPayload
>;

export const ProductionWaitReadyPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
	productionPort: Schema.Number.pipe(Schema.int(), Schema.positive()),
	productionHash: Schema.String.pipe(Schema.minLength(1)),
	startedAt: Schema.Number,
	rescheduleCount: Schema.optional(Schema.Number).pipe(
		Schema.withConstructorDefault(() => 0),
	),
});

export type ProductionWaitReadyPayload = Schema.Schema.Type<
	typeof ProductionWaitReadyPayload
>;

export const ProductionStopPayload = Schema.Struct({
	projectId: Schema.String.pipe(Schema.minLength(1)),
});

export type ProductionStopPayload = Schema.Schema.Type<
	typeof ProductionStopPayload
>;

const payloadSchemas: Record<string, Schema.Schema<unknown, unknown, never>> = {
	"project.create": ProjectCreatePayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"project.delete": ProjectDeletePayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"projects.deleteAllForUser": ProjectsDeleteAllForUserPayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"docker.composeUp": DockerComposeUpPayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"docker.waitReady": DockerWaitReadyPayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"docker.ensureRunning": DockerEnsureRunningPayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"docker.stop": DockerStopPayload as Schema.Schema<unknown, unknown, never>,
	"opencode.sessionCreate": OpencodeSessionCreatePayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"opencode.sendInitialPrompt":
		OpencodeSendInitialPromptPayload as Schema.Schema<unknown, unknown, never>,
	"opencode.sendUserPrompt": OpencodeSendUserPromptPayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"production.build": ProductionBuildPayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"production.start": ProductionStartPayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"production.waitReady": ProductionWaitReadyPayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
	"production.stop": ProductionStopPayload as Schema.Schema<
		unknown,
		unknown,
		never
	>,
};

export function parsePayload<T extends QueueJobType>(
	type: T,
	payloadJson: string,
): unknown {
	const raw = JSON.parse(payloadJson) as unknown;
	const schema = payloadSchemas[type];
	if (!schema) {
		throw new Error(`Unknown job type: ${type}`);
	}
	return Schema.decodeUnknownSync(schema)(raw);
}
