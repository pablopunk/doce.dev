import * as path from "node:path";
import { logger } from "@/server/logger";
import { getDataPath } from "@/server/projects/paths";
import { isRunningInDocker } from "@/server/utils/docker";
import { runCommand } from "@/server/utils/execAsync";

let cachedHostDataPath: string | null = null;

function getCurrentContainerId(): string | null {
	return process.env.HOSTNAME || null;
}

async function inspectHostDataPath(): Promise<string> {
	if (cachedHostDataPath) {
		return cachedHostDataPath;
	}

	const explicit = process.env.DOCE_HOST_DATA_DIR;
	if (explicit) {
		cachedHostDataPath = path.resolve(explicit);
		return cachedHostDataPath;
	}

	if (!isRunningInDocker()) {
		cachedHostDataPath = getDataPath();
		return cachedHostDataPath;
	}

	const containerId = getCurrentContainerId();
	if (!containerId) {
		throw new Error(
			"Cannot determine current container ID to resolve host data path",
		);
	}

	const result = await runCommand(
		`docker inspect ${containerId} --format '{{ json .Mounts }}'`,
		{ timeout: 5_000 },
	);

	if (!result.success) {
		throw new Error(
			`Failed to inspect current container mounts: ${result.stderr}`,
		);
	}

	const mounts = JSON.parse(result.stdout) as Array<{
		Destination?: string;
		Source?: string;
	}>;
	const dataMount = mounts.find((mount) => mount.Destination === getDataPath());

	if (!dataMount?.Source) {
		throw new Error(
			`Could not resolve host path for mounted data directory ${getDataPath()}`,
		);
	}

	cachedHostDataPath = dataMount.Source;
	logger.info(
		{ hostDataPath: cachedHostDataPath },
		"Resolved host data directory",
	);
	return cachedHostDataPath;
}

export async function resolveHostPath(containerPath: string): Promise<string> {
	const absoluteContainerPath = path.resolve(containerPath);
	const dataPath = path.resolve(getDataPath());
	const relativePath = path.relative(dataPath, absoluteContainerPath);

	if (relativePath.startsWith("..")) {
		throw new Error(
			`Path ${absoluteContainerPath} is outside the data directory ${dataPath}`,
		);
	}

	const hostDataPath = await inspectHostDataPath();
	return path.join(hostDataPath, relativePath);
}
