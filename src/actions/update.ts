import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { logger } from "@/server/logger";
import { spawnCommand } from "@/server/utils/execAsync";
import { VERSION } from "@/server/version";

const REGISTRY = "ghcr.io";
const REPO_PATH = "pablopunk/doce.dev";
const IMAGE_NAME = `${REGISTRY}/${REPO_PATH}`;
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
	digest: string;
	version: string | undefined;
	timestamp: number;
}

let remoteCache: CacheEntry | undefined;

async function getGhcrToken(): Promise<string> {
	const tokenUrl = `https://${REGISTRY}/token?service=${REGISTRY}&scope=repository:${REPO_PATH}:pull`;
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

async function fetchRemoteDigest(): Promise<string> {
	const token = await getGhcrToken();

	const indexUrl = `https://${REGISTRY}/v2/${REPO_PATH}/manifests/latest`;
	const indexResponse = await fetch(indexUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.oci.image.index.v1+json",
		},
		signal: AbortSignal.timeout(10000),
	});

	if (!indexResponse.ok) {
		throw new Error(
			`Failed to fetch manifest index: ${indexResponse.status} ${indexResponse.statusText}`,
		);
	}

	const index = (await indexResponse.json()) as {
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

	const manifestUrl = `https://${REGISTRY}/v2/${REPO_PATH}/manifests/${amd64Manifest.digest}`;
	const manifestResponse = await fetch(manifestUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.oci.image.manifest.v1+json",
		},
		signal: AbortSignal.timeout(10000),
	});

	if (!manifestResponse.ok) {
		throw new Error(
			`Failed to fetch platform manifest: ${manifestResponse.status} ${manifestResponse.statusText}`,
		);
	}

	const contentDigest = manifestResponse.headers.get("docker-content-digest");
	return contentDigest || amd64Manifest.digest;
}

async function fetchRemoteVersion(): Promise<string | undefined> {
	const token = await getGhcrToken();

	const indexUrl = `https://${REGISTRY}/v2/${REPO_PATH}/manifests/latest`;
	const indexResponse = await fetch(indexUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.oci.image.index.v1+json",
		},
		signal: AbortSignal.timeout(10000),
	});

	if (!indexResponse.ok) {
		throw new Error(
			`Failed to fetch manifest index: ${indexResponse.status} ${indexResponse.statusText}`,
		);
	}

	const index = (await indexResponse.json()) as {
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

	const manifestUrl = `https://${REGISTRY}/v2/${REPO_PATH}/manifests/${amd64Manifest.digest}`;
	const manifestResponse = await fetch(manifestUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.oci.image.manifest.v1+json",
		},
		signal: AbortSignal.timeout(10000),
	});

	if (!manifestResponse.ok) {
		throw new Error(
			`Failed to fetch platform manifest: ${manifestResponse.status} ${manifestResponse.statusText}`,
		);
	}

	const manifest = (await manifestResponse.json()) as {
		config?: { digest: string };
	};

	if (!manifest.config?.digest) {
		return undefined;
	}

	const configUrl = `https://${REGISTRY}/v2/${REPO_PATH}/blobs/${manifest.config.digest}`;
	const configResponse = await fetch(configUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.oci.image.config.v1+json",
		},
		signal: AbortSignal.timeout(10000),
	});

	if (!configResponse.ok) {
		return undefined;
	}

	const config = (await configResponse.json()) as {
		history?: Array<{ created_by?: string }>;
	};

	const versionPattern = /VERSION=(\d{4}-\d{2}-\d{2}-[a-f0-9]+)/;
	for (const layer of config.history ?? []) {
		const match = layer.created_by?.match(versionPattern);
		if (match) {
			return match[1];
		}
	}

	return undefined;
}

async function getLocalImageDigest(): Promise<string | null> {
	const result = await spawnCommand(
		"docker",
		[
			"inspect",
			"--format",
			"{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}",
			`${IMAGE_NAME}:latest`,
		],
		{ timeout: 10000 },
	);

	if (!result.success || !result.stdout.trim()) {
		return null;
	}

	const match = result.stdout.trim().match(/@(sha256:[a-f0-9]+)/);
	return match?.[1] ?? null;
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
				if (VERSION === "unknown" || VERSION === "dev") {
					logger.warn("No VERSION env var set in container");
					return {
						hasUpdate: false,
						error:
							"Version not available. This container was built without version info.",
					};
				}

				if (isCacheValid(remoteCache)) {
					const localDigest = await getLocalImageDigest();
					logger.info(
						`Comparing digests (cache hit): local=${localDigest} remote=${remoteCache?.digest}`,
					);
					return {
						hasUpdate: localDigest !== remoteCache?.digest,
						newVersion: remoteCache?.version,
					};
				}

				let remoteDigest: string;
				let remoteVersion: string | undefined;
				try {
					remoteDigest = await fetchRemoteDigest();
					remoteVersion = await fetchRemoteVersion();
					remoteCache = { digest: remoteDigest, version: remoteVersion, timestamp: Date.now() };
				} catch (err) {
					const message =
						err instanceof Error ? err.message : "Unknown error";
					logger.error(
						{ err },
						`Failed to check remote version: ${message}`,
					);
					return {
						hasUpdate: false,
						error: `Failed to check for updates: ${message}`,
					};
				}

				const localDigest = await getLocalImageDigest();
				logger.info(
					`Comparing digests: local=${localDigest} remote=${remoteDigest}`,
				);

				return {
					hasUpdate: localDigest !== remoteDigest,
					newVersion: remoteVersion,
				};
			} catch (err) {
				const message =
					err instanceof Error ? err.message : "Unknown error";
				logger.error(
					{ err },
					`Unexpected error in checkForUpdate: ${message}`,
				);
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
				const message =
					err instanceof Error ? err.message : "Unknown error";
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
				const message =
					err instanceof Error ? err.message : "Unknown error";
				logger.error({ err }, `Unexpected error in restart: ${message}`);
				return {
					success: false,
					error: `Failed to restart: ${message}`,
				};
			}
		},
	}),
};
