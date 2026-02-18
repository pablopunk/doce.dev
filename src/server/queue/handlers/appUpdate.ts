import { Effect } from "effect";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { spawnCommand } from "@/server/utils/execAsync";
import { parsePayload } from "../types";

const IMAGE_NAME = "ghcr.io/pablopunk/doce.dev:latest";

interface PullResult {
	success: boolean;
	downloaded: string;
	status: string;
	error?: string;
}

async function detectContainerName(): Promise<string | null> {
	const hostname = process.env.HOSTNAME || process.env.HOST;
	if (hostname) {
		const result = await spawnCommand("docker", [
			"ps",
			"--filter",
			`name=${hostname}`,
			"--format",
			"{{.Names}}",
		]);
		if (result.success && result.stdout.trim()) {
			return result.stdout.trim();
		}
	}

	const inspectResult = await spawnCommand("docker", [
		"inspect",
		"--format",
		"{{.Name}}",
		process.env.HOSTNAME || "doce",
	]);
	if (inspectResult.success && inspectResult.stdout.trim()) {
		return inspectResult.stdout.trim().replace(/^\//, "");
	}

	return null;
}

async function pullImage(): Promise<PullResult> {
	logger.info("Pulling latest doce.dev image");

	const result = await spawnCommand("docker", ["pull", IMAGE_NAME], {
		timeout: 600_000,
	});

	if (result.success) {
		const inspectResult = await spawnCommand("docker", [
			"inspect",
			IMAGE_NAME,
			"--format",
			"{{.Id}}",
		]);
		const imageId = inspectResult.success
			? inspectResult.stdout.trim()
			: "unknown";

		return {
			success: true,
			downloaded: imageId,
			status: "Image pulled successfully",
		};
	}

	const stderr = result.stderr.toLowerCase();
	let errorMessage = result.stderr.slice(0, 500);

	if (
		stderr.includes("no space left on device") ||
		stderr.includes("disk full")
	) {
		errorMessage = "Disk space insufficient to pull image";
	} else if (
		stderr.includes("network") ||
		stderr.includes("connection") ||
		stderr.includes("timeout")
	) {
		errorMessage = "Network error while pulling image";
	} else if (
		stderr.includes("daemon") ||
		stderr.includes("docker is not running")
	) {
		errorMessage = "Docker daemon is not running";
	} else if (
		stderr.includes("unauthorized") ||
		stderr.includes("authentication")
	) {
		errorMessage = "Authentication failed for container registry";
	} else if (
		stderr.includes("not found") ||
		stderr.includes("does not exist")
	) {
		errorMessage = "Image not found in registry";
	}

	return {
		success: false,
		downloaded: "",
		status: "Pull failed",
		error: errorMessage,
	};
}

export const handleAppUpdate = (
	ctx: QueueJobContext,
): Effect.Effect<void, Error> =>
	Effect.gen(function* () {
		parsePayload("app.update", ctx.job.payloadJson);

		yield* ctx.throwIfCancelRequested();

		const containerName = yield* Effect.tryPromise({
			try: detectContainerName,
			catch: (error) => new Error(`Failed to detect container name: ${error}`),
		});

		yield* Effect.logInfo("Detected container for update", {
			containerName,
		});

		yield* ctx.throwIfCancelRequested();

		const pullResult = yield* Effect.tryPromise({
			try: pullImage,
			catch: (error) => new Error(`Failed to pull image: ${error}`),
		});

		if (!pullResult.success) {
			logger.error(
				{ error: pullResult.error },
				"Failed to pull doce.dev image",
			);
			yield* Effect.fail(new Error(pullResult.error));
			return;
		}

		logger.info(
			{
				imageId: pullResult.downloaded,
				containerName,
			},
			"Successfully pulled doce.dev image",
		);
	});
