import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Effect } from "effect";
import {
	FilesystemError,
	ProjectError,
	QueueError,
} from "@/server/effect/errors";
import { generateProjectName } from "@/server/llm/autoname";
import { logger } from "@/server/logger";
import { ensureAuthDirectory } from "@/server/opencode/authFile";
import { allocateProjectPorts } from "@/server/ports/allocate";
import {
	createProject,
	updateOpencodeJsonModel,
} from "@/server/projects/projects.model";
import { setupProjectFilesystem } from "@/server/projects/setup";
import { enqueueDockerComposeUp } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import type { ImageAttachment } from "../types";
import { parsePayload } from "../types";

const toFilesystemError = (
	error: unknown,
	operation: "read" | "write" | "delete" | "mkdir",
	filePath: string,
): FilesystemError =>
	new FilesystemError({
		path: filePath,
		operation,
		message: error instanceof Error ? error.message : String(error),
		cause: error,
	});

const toProjectError = (
	error: unknown,
	operation: string,
	projectId?: string,
): ProjectError =>
	new ProjectError({
		projectId,
		operation,
		message: error instanceof Error ? error.message : String(error),
		cause: error,
	});

const toQueueError = (error: unknown, jobId?: string): QueueError =>
	new QueueError({
		message: error instanceof Error ? error.message : String(error),
		jobId,
		cause: error,
	});

const writeProjectImages = (
	projectPath: string,
	images: Array<ImageAttachment>,
): Effect.Effect<void, FilesystemError> =>
	Effect.gen(function* () {
		const imagesPath = path.join(projectPath, ".doce-images.json");
		yield* Effect.tryPromise({
			try: () => fs.writeFile(imagesPath, JSON.stringify(images)),
			catch: (error) => toFilesystemError(error, "write", imagesPath),
		});
	});

const allocatePortsEffect = (): Effect.Effect<
	{ devPort: number; opencodePort: number },
	ProjectError
> =>
	Effect.tryPromise({
		try: allocateProjectPorts,
		catch: (error) => toProjectError(error, "allocateProjectPorts", undefined),
	});

const ensureAuthDirectoryEffect = (): Effect.Effect<void, FilesystemError> =>
	Effect.tryPromise({
		try: ensureAuthDirectory,
		catch: (error) => toFilesystemError(error, "mkdir", "auth-directory"),
	});

const setupFilesystemEffect = (
	projectId: string,
	devPort: number,
	opencodePort: number,
): Effect.Effect<
	{ projectPath: string; productionPort: number },
	ProjectError
> =>
	Effect.tryPromise({
		try: () => setupProjectFilesystem(projectId, devPort, opencodePort),
		catch: (error) =>
			toProjectError(error, "setupProjectFilesystem", projectId),
	});

const updateModelEffect = (
	projectId: string,
	model: string,
): Effect.Effect<void, ProjectError> =>
	Effect.tryPromise({
		try: () => updateOpencodeJsonModel(projectId, model),
		catch: (error) =>
			toProjectError(error, "updateOpencodeJsonModel", projectId),
	});

const generateNameEffect = (prompt: string): Effect.Effect<string, never> =>
	Effect.tryPromise({
		try: () => generateProjectName(prompt),
		catch: () => Effect.succeed("untitled-project"),
	}).pipe(Effect.orElse(() => Effect.succeed("untitled-project")));

const createProjectEffect = (params: {
	id: string;
	ownerUserId: string;
	name: string;
	slug: string;
	prompt: string;
	devPort: number;
	opencodePort: number;
	productionPort: number;
	projectPath: string;
}): Effect.Effect<void, ProjectError> =>
	Effect.tryPromise({
		try: () =>
			createProject({
				id: params.id,
				ownerUserId: params.ownerUserId,
				createdAt: new Date(),
				name: params.name,
				slug: params.slug,
				prompt: params.prompt,
				devPort: params.devPort,
				opencodePort: params.opencodePort,
				productionPort: params.productionPort,
				status: "created",
				pathOnDisk: params.projectPath,
			}),
		catch: (error) => toProjectError(error, "createProject", params.id),
	}).pipe(Effect.map(() => undefined));

const enqueueDockerUpEffect = (
	projectId: string,
): Effect.Effect<void, QueueError> =>
	Effect.tryPromise({
		try: () => enqueueDockerComposeUp({ projectId, reason: "bootstrap" }),
		catch: (error) => toQueueError(error, projectId),
	}).pipe(Effect.map(() => undefined));

export async function handleProjectCreate(ctx: QueueJobContext): Promise<void> {
	const payload = parsePayload("project.create", ctx.job.payloadJson);
	const { projectId, ownerUserId, prompt, model, images } = payload;

	logger.info({ projectId, prompt: prompt.slice(0, 100) }, "Creating project");

	const program = Effect.gen(function* () {
		yield* Effect.tryPromise({
			try: () => ctx.throwIfCancelRequested(),
			catch: (error) => toQueueError(error, ctx.job.id),
		});

		const [{ devPort, opencodePort }] = yield* Effect.all(
			[allocatePortsEffect(), ensureAuthDirectoryEffect()],
			{ concurrency: 2 },
		);

		logger.debug({ projectId, devPort, opencodePort }, "Allocated ports");

		const { projectPath, productionPort } = yield* setupFilesystemEffect(
			projectId,
			devPort,
			opencodePort,
		);

		logger.debug({ projectId, projectPath }, "Set up project filesystem");

		yield* Effect.tryPromise({
			try: () => ctx.throwIfCancelRequested(),
			catch: (error) => toQueueError(error, ctx.job.id),
		});

		if (model) {
			yield* updateModelEffect(projectId, model);
			logger.debug(
				{ projectId, model },
				"Updated preview/opencode.json with model",
			);
		}

		yield* Effect.tryPromise({
			try: () => ctx.throwIfCancelRequested(),
			catch: (error) => toQueueError(error, ctx.job.id),
		});

		if (images && images.length > 0) {
			yield* writeProjectImages(projectPath, images);
			logger.debug(
				{ projectId, imageCount: images.length },
				"Saved images for initial prompt",
			);
		}

		yield* Effect.tryPromise({
			try: () => ctx.throwIfCancelRequested(),
			catch: (error) => toQueueError(error, ctx.job.id),
		});

		const name = yield* generateNameEffect(prompt);
		const slug = name;

		yield* createProjectEffect({
			id: projectId,
			ownerUserId,
			name,
			slug,
			prompt,
			devPort,
			opencodePort,
			productionPort,
			projectPath,
		});

		logger.info({ projectId, name, slug }, "Created project in database");

		yield* enqueueDockerUpEffect(projectId);
		logger.debug({ projectId }, "Enqueued docker.composeUp");
	}).pipe(
		Effect.catchAll((error) =>
			Effect.sync(() => {
				logger.error(
					{
						projectId,
						error: error instanceof Error ? error.message : String(error),
					},
					"Failed to create project",
				);
				throw error;
			}),
		),
	);

	await Effect.runPromise(program);
}
