/**
 * Image prewarm — pre-pull base images and pre-build Dockerfiles at app startup
 * so the first project creation is fast.
 *
 * Runs non-blocking in the background. Status is exposed via getPrewarmStatus()
 * for the diagnostics UI.
 */

import * as path from "node:path";
import { logger } from "@/server/logger";
import { getTemplatePath } from "@/server/projects/paths";
import { runCommand } from "@/server/utils/execAsync";

type PrewarmPhase = "idle" | "pulling" | "building" | "done" | "failed";

interface PrewarmState {
	phase: PrewarmPhase;
	startedAt: number | null;
	completedAt: number | null;
	error: string | null;
	pulledImages: string[];
	builtDockerfiles: string[];
}

const state: PrewarmState = {
	phase: "idle",
	startedAt: null,
	completedAt: null,
	error: null,
	pulledImages: [],
	builtDockerfiles: [],
};

/** Base images used by the template Dockerfiles. */
const BASE_IMAGES = ["node:22-alpine", "node:22-slim"] as const;

/** Dockerfiles to pre-build (path relative to template dir, and a tag for the cache). */
const DOCKERFILES_TO_BUILD = [
	{ file: "Dockerfile.preview", tag: "doce-prewarm-preview" },
	{ file: "Dockerfile.prod", tag: "doce-prewarm-prod" },
] as const;

const PULL_TIMEOUT_MS = 120_000;
const BUILD_TIMEOUT_MS = 180_000;

async function isImageCached(image: string): Promise<boolean> {
	const result = await runCommand(`docker image inspect ${image}`, {
		timeout: 5_000,
	});
	return result.success;
}

async function pullImage(image: string): Promise<boolean> {
	logger.info({ image }, "[Prewarm] Pulling base image");
	const result = await runCommand(`docker pull ${image}`, {
		timeout: PULL_TIMEOUT_MS,
	});
	if (!result.success) {
		logger.warn(
			{ image, stderr: result.stderr },
			"[Prewarm] Failed to pull image",
		);
	}
	return result.success;
}

async function buildDockerfile(
	templateDir: string,
	dockerfile: string,
	tag: string,
): Promise<boolean> {
	logger.info({ dockerfile, tag }, "[Prewarm] Pre-building Dockerfile");
	const result = await runCommand(
		`docker build -f ${path.join(templateDir, dockerfile)} -t ${tag} ${templateDir}`,
		{ timeout: BUILD_TIMEOUT_MS },
	);
	if (!result.success) {
		logger.warn(
			{ dockerfile, stderr: result.stderr },
			"[Prewarm] Failed to pre-build Dockerfile",
		);
	}
	return result.success;
}

async function runPrewarm(): Promise<void> {
	state.phase = "pulling";
	state.startedAt = Date.now();

	const templateDir = getTemplatePath();

	// Phase 1: Pull base images (skip already cached)
	for (const image of BASE_IMAGES) {
		if (await isImageCached(image)) {
			logger.info({ image }, "[Prewarm] Base image already cached, skipping");
			state.pulledImages.push(image);
			continue;
		}
		if (await pullImage(image)) {
			state.pulledImages.push(image);
		}
	}

	// Phase 2: Pre-build Dockerfiles to warm the layer cache
	state.phase = "building";
	for (const { file, tag } of DOCKERFILES_TO_BUILD) {
		if (await buildDockerfile(templateDir, file, tag)) {
			state.builtDockerfiles.push(file);
		}
	}

	state.phase = "done";
	state.completedAt = Date.now();

	const durationMs = state.completedAt - (state.startedAt ?? state.completedAt);
	logger.info(
		{
			durationMs,
			pulledImages: state.pulledImages,
			builtDockerfiles: state.builtDockerfiles,
		},
		"[Prewarm] Image prewarm completed",
	);
}

let prewarmStarted = false;

/**
 * Start the prewarm process (non-blocking, fire-and-forget).
 * Safe to call multiple times — only runs once.
 */
export function startImagePrewarm(): void {
	if (prewarmStarted) return;
	prewarmStarted = true;

	runPrewarm().catch((error) => {
		state.phase = "failed";
		state.error = error instanceof Error ? error.message : String(error);
		state.completedAt = Date.now();
		logger.error({ error }, "[Prewarm] Image prewarm failed");
	});
}

export interface PrewarmStatus {
	phase: PrewarmPhase;
	startedAt: number | null;
	completedAt: number | null;
	error: string | null;
	pulledImages: string[];
	builtDockerfiles: string[];
}

/** Get current prewarm status for the diagnostics UI. */
export function getPrewarmStatus(): PrewarmStatus {
	return { ...state };
}
