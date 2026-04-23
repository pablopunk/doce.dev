import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { logger } from "@/server/logger";
import { spawnCommand } from "@/server/utils/execAsync";
import { VERSION } from "@/server/version";

const IMAGE_NAME = "ghcr.io/pablopunk/doce.dev";
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
	digest: string;
	tag: string;
	timestamp: number;
}

interface VersionCache {
	remote?: CacheEntry;
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

async function fetchRemoteDigest(): Promise<{ digest: string; tag: string }> {
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

	const tag = await fetchLatestTag(token);

	return { digest: amd64Manifest.digest, tag };
}

async function fetchLatestTag(token: string): Promise<string> {
	try {
		const tagsUrl = `https://ghcr.io/v2/pablopunk/doce.dev/tags/list`;
		const response = await fetch(tagsUrl, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) return "latest";

		const data = (await response.json()) as { tags?: string[] };
		// Only consider date-prefixed tags (YYYY-MM-DD-sha) to avoid raw git SHAs
		const dateTagPattern = /^\d{4}-\d{2}-\d{2}-[a-f0-9]+$/;
		const tags = data.tags?.filter((t) => dateTagPattern.test(t)) ?? [];

		tags.sort((a, b) => b.localeCompare(a));
		return tags[0] ?? "latest";
	} catch {
		return "latest";
	}
}

async function getLocalImageDigest(): Promise<string | null> {
	// Inspect the image directly for its RepoDigests, which contains the
	// manifest digest (matches what GHCR returns). The container's .Image
	// field is the image config blob digest, which is different.
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

				if (isCacheValid(versionCache.remote)) {
					const localDigest = await getLocalImageDigest();
					logger.info({ localDigest, cachedRemoteDigest: versionCache.remote?.digest }, "Comparing digests (cache hit)");
					const hasUpdate = localDigest !== versionCache.remote?.digest;
					return {
						hasUpdate,
						currentVersion: VERSION,
						remoteVersion: versionCache.remote?.tag,
					};
				}

				let remoteInfo: { digest: string; tag: string };
				try {
					remoteInfo = await fetchRemoteDigest();
					versionCache.remote = {
						digest: remoteInfo.digest,
						tag: remoteInfo.tag,
						timestamp: Date.now(),
					};
				} catch (err) {
					const message = err instanceof Error ? err.message : "Unknown error";
					logger.error({ err }, `Failed to check remote version: ${message}`);
					return {
						hasUpdate: false,
						currentVersion: VERSION,
						error: `Failed to check for updates: ${message}`,
					};
				}

				const localDigest = await getLocalImageDigest();
				logger.info({ localDigest, remoteDigest: remoteInfo.digest }, "Comparing digests");
				const hasUpdate = localDigest !== remoteInfo.digest;

				return {
					hasUpdate,
					currentVersion: VERSION,
					remoteVersion: remoteInfo.tag,
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
