import { Effect } from "effect";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { spawnCommand } from "@/server/utils/execAsync";
import { parsePayload } from "../types";

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

interface RestartResult {
	success: boolean;
	containerName: string;
	error?: string;
}

async function restartContainer(containerName: string): Promise<RestartResult> {
	logger.info("Restarting doce.dev container", { containerName });

	const stopResult = await spawnCommand("docker", ["stop", containerName], {
		timeout: 60_000,
	});

	if (!stopResult.success) {
		const stderr = stopResult.stderr.toLowerCase();
		let errorMessage = stopResult.stderr.slice(0, 500);

		if (stderr.includes("no such container")) {
			errorMessage = "Container not found";
		} else if (stderr.includes("daemon")) {
			errorMessage = "Docker daemon is not running";
		}

		return {
			success: false,
			containerName,
			error: `Failed to stop container: ${errorMessage}`,
		};
	}

	const startResult = await spawnCommand("docker", ["start", containerName], {
		timeout: 60_000,
	});

	if (!startResult.success) {
		const stderr = startResult.stderr.toLowerCase();
		let errorMessage = startResult.stderr.slice(0, 500);

		if (stderr.includes("no such container")) {
			errorMessage = "Container not found after stop";
		} else if (stderr.includes("daemon")) {
			errorMessage = "Docker daemon is not running";
		}

		return {
			success: false,
			containerName,
			error: `Failed to start container: ${errorMessage}`,
		};
	}

	return {
		success: true,
		containerName,
	};
}

export const handleAppRestart = (
	ctx: QueueJobContext,
): Effect.Effect<void, Error> =>
	Effect.gen(function* () {
		parsePayload("app.restart", ctx.job.payloadJson);

		yield* ctx.throwIfCancelRequested();

		const containerName = yield* Effect.tryPromise({
			try: detectContainerName,
			catch: (error) => new Error(`Failed to detect container name: ${error}`),
		});

		if (!containerName) {
			yield* Effect.fail(
				new Error("Could not detect running doce.dev container"),
			);
			return;
		}

		yield* Effect.logInfo("Detected container for restart", { containerName });

		yield* ctx.throwIfCancelRequested();

		const restartResult = yield* Effect.tryPromise({
			try: () => restartContainer(containerName),
			catch: (error) => new Error(`Failed to restart container: ${error}`),
		});

		if (!restartResult.success) {
			logger.error(
				{ error: restartResult.error },
				"Failed to restart doce.dev container",
			);
			yield* Effect.fail(new Error(restartResult.error));
			return;
		}

		logger.info(
			{ containerName: restartResult.containerName },
			"Successfully restarted doce.dev container",
		);
	});
