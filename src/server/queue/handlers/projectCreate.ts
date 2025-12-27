import * as fs from "node:fs/promises";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { userSettings } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { allocateProjectPorts } from "@/server/ports/allocate";
import { createProject } from "@/server/projects/projects.model";
import {
	setupProjectFilesystem,
	updateOpencodeModel,
} from "@/server/projects/setup";
import { generateUniqueSlug } from "@/server/projects/slug";
import { generateProjectName } from "@/server/settings/openrouter";
import { enqueueDockerComposeUp } from "../enqueue";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";

export async function handleProjectCreate(ctx: QueueJobContext): Promise<void> {
	const payload = parsePayload("project.create", ctx.job.payloadJson);
	const { projectId, ownerUserId, prompt, model, images } = payload;

	logger.info({ projectId, prompt: prompt.slice(0, 100) }, "Creating project");

	try {
		await ctx.throwIfCancelRequested();

		// Get user's OpenRouter API key
		const settings = await db
			.select()
			.from(userSettings)
			.where(eq(userSettings.userId, ownerUserId))
			.limit(1);

		const openrouterApiKey = settings[0]?.openrouterApiKey;
		if (!openrouterApiKey) {
			throw new Error("User has no OpenRouter API key configured");
		}

		await ctx.throwIfCancelRequested();

		// Generate project name using AI
		const name = await generateProjectName(openrouterApiKey, prompt);
		logger.debug({ projectId, name }, "Generated project name");

		await ctx.throwIfCancelRequested();

		// Generate unique slug
		const slug = await generateUniqueSlug(name);
		logger.debug({ projectId, slug }, "Generated unique slug");

		// Allocate ports
		const { devPort, opencodePort } = await allocateProjectPorts();
		logger.debug({ projectId, devPort, opencodePort }, "Allocated ports");

		await ctx.throwIfCancelRequested();

		// Set up project filesystem (template copy, .env file, logs dir)
		const { projectPath, relativePath } = await setupProjectFilesystem(
			projectId,
			devPort,
			opencodePort,
			openrouterApiKey,
		);
		logger.debug({ projectId, projectPath }, "Set up project filesystem");

		await ctx.throwIfCancelRequested();

		// Update opencode.json with the selected model
		if (model) {
			await updateOpencodeModel(projectPath, model);
			logger.debug({ projectId, model }, "Updated opencode.json with model");
		}

		// Save images to temp file for later use in sendUserPrompt
		if (images && images.length > 0) {
			await writeProjectImages(projectPath, images);
			logger.debug(
				{ projectId, imageCount: images.length },
				"Saved images for initial prompt",
			);
		}

		await ctx.throwIfCancelRequested();

		// Create DB record
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

		// Enqueue next step: docker compose up
		await enqueueDockerComposeUp({ projectId, reason: "bootstrap" });
		logger.debug({ projectId }, "Enqueued docker.composeUp");
	} catch (error) {
		if (error instanceof Error) {
			logger.error(
				{ projectId, error: error.message },
				"Failed to create project",
			);
		}
		throw error;
	}
}

/**
 * Write images to a temporary file for use during initial prompt.
 * This file will be read and deleted by opencodeSendUserPrompt handler.
 */
async function writeProjectImages(
	projectPath: string,
	images: Array<{ filename: string; mime: string; dataUrl: string }>,
): Promise<void> {
	const imagesPath = path.join(projectPath, ".doce-images.json");
	await fs.writeFile(imagesPath, JSON.stringify(images));
}
