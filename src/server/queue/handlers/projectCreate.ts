import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { allocateProjectPorts } from "@/server/ports/allocate";
import { createProject } from "@/server/projects/projects.model";
import {
	setupProjectFilesystem,
	updateOpencodeModel,
} from "@/server/projects/setup";
import { generateProjectNameWithLLM } from "@/server/projects/autoname";
import { enqueueDockerComposeUp } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { ensureAuthDirectory } from "@/server/opencode/authFile";

export async function handleProjectCreate(ctx: QueueJobContext): Promise<void> {
	const payload = parsePayload("project.create", ctx.job.payloadJson);
	const { projectId, ownerUserId, prompt, model, images } = payload;

	logger.info({ projectId, prompt: prompt.slice(0, 100) }, "Creating project");

	try {
		await ctx.throwIfCancelRequested();

		const { devPort, opencodePort } = await allocateProjectPorts();
		logger.debug({ projectId, devPort, opencodePort }, "Allocated ports");

		await ensureAuthDirectory();

		const { projectPath, relativePath } = await setupProjectFilesystem(
			projectId,
			devPort,
			opencodePort,
		);
		logger.debug({ projectId, projectPath }, "Set up project filesystem");

		await ctx.throwIfCancelRequested();

		if (model) {
			await updateOpencodeModel(projectPath, model);
			logger.debug({ projectId, model }, "Updated opencode.json with model");
		}

		await ctx.throwIfCancelRequested();

		if (images && images.length > 0) {
			await writeProjectImages(projectPath, images);
			logger.debug(
				{ projectId, imageCount: images.length },
				"Saved images for initial prompt",
			);
		}

		await ctx.throwIfCancelRequested();

		const name = await generateProjectNameWithLLM(prompt);
		const slug = name;

		await createProject({
			id: projectId,
			ownerUserId,
			createdAt: new Date(),
			name,
			slug,
			prompt,
			model,
			devPort,
			opencodePort,
			status: "created",
			pathOnDisk: relativePath,
		});

		logger.info({ projectId, name, slug }, "Created project in database");

		await enqueueDockerComposeUp({ projectId, reason: "bootstrap" });
		logger.debug({ projectId }, "Enqueued docker.composeUp");
	} catch (error) {
		logger.error(
			{
				projectId,
				error: error instanceof Error ? error.message : String(error),
			},
			"Failed to create project",
		);
		throw error;
	}
}

async function writeProjectImages(
	projectPath: string,
	images: Array<{ filename: string; mime: string; dataUrl: string }>,
): Promise<void> {
	const imagesPath = path.join(projectPath, ".doce-images.json");
	await fs.writeFile(imagesPath, JSON.stringify(images));
}
