import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { logger } from "@/server/logger";
import { spawnCommand } from "@/server/utils/execAsync";

const IMAGE_NAME = "ghcr.io/pablopunk/doce.dev";
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
	version: string;
	timestamp: number;
}

interface VersionCache {
	remote?: CacheEntry;
	local?: CacheEntry;
}

const versionCache: VersionCache = {};

async function getGhcrToken(): Promise<string> {
	const tokenUrl = `https://ghcr.io/token?service=ghcr.io&scope=repository:pablopunk/doce.dev:pull`;
	const response = await fetch(tokenUrl, {
		signal: AbortSignal.timeout(10000),
	});

	if (!response.ok) {
		throw new Error(
			`Failed to get GHCR token: ${response.status} ${response.statusText}`,
		);
	}

	const data = (await response.json()) as { token?: string };
	if (!data.token) {
		throw new Error("No token in GHCR response");
	}

	return data.token;
}

async function fetchRemoteVersion(): Promise<string> {
	const token = await getGhcrToken();
	const manifestUrl = `https://ghcr.io/v2/pablopunk/doce.dev/manifests/latest`;
	const response = await fetch(manifestUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.oci.image.index.v1+json",
		},
		signal: AbortSignal.timeout(10000),
	});

	if (!response.ok) {
		throw new Error(
			`Failed to fetch manifest: ${response.status} ${response.statusText}`,
		);
	}

	const index = (await response.json()) as {
		manifests?: Array<{
			digest: string;
			platform?: { architecture: string; os: string };
		}>;
	};

	const amd64Manifest = index.manifests?.find(
		(m) => m.platform?.architecture === "amd64" && m.platform?.os === "linux",
	);

	if (!amd64Manifest) {
		throw new Error("No amd64/linux manifest found");
	}

	return amd64Manifest.digest;
}

function getLocalVersion(): string | null {
	return process.env.VERSION || null;
}

function isCacheValid(entry: CacheEntry | undefined): boolean {
	if (!entry) return false;
	return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

async function getContainerName(): Promise<string> {
	const hostnameResult = await spawnCommand("hostname", [], { timeout: 5000 });
	if (hostnameResult.success && hostnameResult.stdout.trim()) {
		const hostname = hostnameResult.stdout.trim();
		const inspectResult = await spawnCommand(
			"docker",
			["inspect", "--format", "{{.Name}}", hostname],
			{ timeout: 10000 },
		);
		if (inspectResult.success) {
			return inspectResult.stdout.trim().replace(/^\//, "");
		}
	}

	const psResult = await spawnCommand(
		"docker",
		["ps", "--filter", "label=app=doce.dev", "--format", "{{.Names}}"],
		{ timeout: 10000 },
	);
	if (psResult.success && psResult.stdout.trim()) {
		const first = psResult.stdout.trim().split("\n")[0];
		if (first) return first;
	}

	return process.env.CONTAINER_NAME || "doce";
}

export const update = {
	checkForUpdate: defineAction({
		accept: "json",
		input: z.object({}),
		handler: async () => {
			try {
				const localVersion = getLocalVersion();

				if (!localVersion || localVersion === "unknown") {
					logger.warn("No VERSION env var set in container");
					return {
						hasUpdate: false,
						error:
							"Version not available. This container was built without version info.",
					};
				}

				if (isCacheValid(versionCache.remote)) {
					const hasUpdate = localVersion !== versionCache.remote?.version;
					return {
						hasUpdate,
						currentVersion: localVersion,
						remoteVersion: versionCache.remote?.version,
					};
				}

				let remoteVersion: string;
				try {
					remoteVersion = await fetchRemoteVersion();
					versionCache.remote = {
						version: remoteVersion,
						timestamp: Date.now(),
					};
				} catch (err) {
					const message = err instanceof Error ? err.message : "Unknown error";
					logger.error({ err }, `Failed to check remote version: ${message}`);
					return {
						hasUpdate: false,
						currentVersion: localVersion,
						error: `Failed to check for updates: ${message}`,
					};
				}

				const hasUpdate = localVersion !== remoteVersion;

				return {
					hasUpdate,
					currentVersion: localVersion,
					remoteVersion,
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : "Unknown error";
				logger.error({ err }, `Unexpected error in checkForUpdate: ${message}`);
				return {
					hasUpdate: false,
					error: `Failed to check for updates: ${message}`,
				};
			}
		},
	}),

	pull: defineAction({
		accept: "json",
		input: z.object({}),
		handler: async () => {
			try {
				const containerName = await getContainerName();
				logger.info({ containerName }, "Pulling latest image");

				const pullResult = await spawnCommand(
					"docker",
					["pull", `${IMAGE_NAME}:latest`],
					{ timeout: 300000 },
				);

				if (!pullResult.success) {
					const errorMsg = pullResult.stderr || "Unknown error";
					logger.error({ error: errorMsg }, "Failed to pull image");
					return {
						success: false,
						error: `Failed to pull image: ${errorMsg}`,
					};
				}

				logger.info("Image pulled successfully");
				return { success: true };
			} catch (err) {
				const message = err instanceof Error ? err.message : "Unknown error";
				logger.error({ err }, `Unexpected error in pull: ${message}`);
				return {
					success: false,
					error: `Failed to pull update: ${message}`,
				};
			}
		},
	}),

	restart: defineAction({
		accept: "json",
		input: z.object({}),
		handler: async () => {
			try {
				const containerName = await getContainerName();
				logger.info({ containerName }, "Restarting container");

				const stopResult = await spawnCommand(
					"docker",
					["stop", containerName],
					{ timeout: 60000 },
				);

				if (!stopResult.success) {
					const errorMsg = stopResult.stderr || "Unknown error";
					logger.error({ error: errorMsg }, "Failed to stop container");
					return {
						success: false,
						error: `Failed to stop container: ${errorMsg}`,
					};
				}

				const startResult = await spawnCommand(
					"docker",
					["start", containerName],
					{ timeout: 60000 },
				);

				if (!startResult.success) {
					const errorMsg = startResult.stderr || "Unknown error";
					logger.error({ error: errorMsg }, "Failed to start container");
					return {
						success: false,
						error: `Failed to start container: ${errorMsg}`,
					};
				}

				logger.info("Container restarted successfully");
				return { success: true };
			} catch (err) {
				const message = err instanceof Error ? err.message : "Unknown error";
				logger.error({ err }, `Unexpected error in restart: ${message}`);
				return {
					success: false,
					error: `Failed to restart: ${message}`,
				};
			}
		},
	}),
};
