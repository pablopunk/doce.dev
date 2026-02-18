import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { logger } from "@/server/logger";
import { spawnCommand } from "@/server/utils/execAsync";

const IMAGE_NAME = "ghcr.io/pablopunk/doce.dev";
const CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
	digest: string;
	timestamp: number;
}

interface DigestCache {
	remote?: CacheEntry;
	local?: CacheEntry;
}

const digestCache: DigestCache = {};

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

async function fetchRemoteDigest(token: string): Promise<string> {
	const manifestUrl = `https://ghcr.io/v2/pablopunk/doce.dev/manifests/latest`;
	const response = await fetch(manifestUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.oci.image.index.v1+json",
		},
		signal: AbortSignal.timeout(10000),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(
			`Failed to fetch manifest: ${response.status} ${response.statusText} - ${errorBody}`,
		);
	}

	const index = (await response.json()) as {
		manifests?: Array<{
			digest: string;
			platform?: { architecture: string; os: string };
		}>;
	};

	if (!index.manifests || index.manifests.length === 0) {
		throw new Error("No manifests found in OCI index");
	}

	const amd64Manifest = index.manifests.find(
		(m) => m.platform?.architecture === "amd64" && m.platform?.os === "linux",
	);

	if (!amd64Manifest) {
		throw new Error("No amd64/linux manifest found in OCI index");
	}

	return amd64Manifest.digest;
}

async function getLocalDigest(): Promise<string | null> {
	const result = await spawnCommand(
		"docker",
		["inspect", "--format", "{{index .RepoDigests 0}}", `${IMAGE_NAME}:latest`],
		{ timeout: 10000 },
	);

	if (!result.success) {
		logger.debug(
			{ stderr: result.stderr },
			"Local image not found or inspect failed",
		);
		return null;
	}

	const output = result.stdout.trim();
	const digestMatch = output.match(/sha256:[a-f0-9]+/);
	if (!digestMatch) {
		logger.warn(
			{ output },
			"Could not parse digest from docker inspect output",
		);
		return null;
	}

	return digestMatch[0];
}

function isCacheValid(entry: CacheEntry | undefined): boolean {
	if (!entry) return false;
	return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

export const update = {
	checkForUpdate: defineAction({
		accept: "json",
		input: z.object({}),
		handler: async () => {
			try {
				if (
					isCacheValid(digestCache.remote) &&
					isCacheValid(digestCache.local)
				) {
					const hasUpdate =
						digestCache.local?.digest !== digestCache.remote?.digest;
					return {
						hasUpdate,
						currentDigest: digestCache.local?.digest,
						remoteDigest: digestCache.remote?.digest,
					};
				}

				let remoteDigest: string;
				try {
					const token = await getGhcrToken();
					remoteDigest = await fetchRemoteDigest(token);
					digestCache.remote = { digest: remoteDigest, timestamp: Date.now() };
				} catch (err) {
					const message = err instanceof Error ? err.message : "Unknown error";
					logger.error({ err }, `Failed to check remote digest: ${message}`);
					return {
						hasUpdate: false,
						error: `Failed to check for updates: ${message}`,
					};
				}

				let localDigest: string | null = null;
				try {
					localDigest = await getLocalDigest();
					if (localDigest) {
						digestCache.local = { digest: localDigest, timestamp: Date.now() };
					}
				} catch (err) {
					const message = err instanceof Error ? err.message : "Unknown error";
					logger.warn({ err }, `Failed to get local digest: ${message}`);
				}

				if (!localDigest) {
					return {
						hasUpdate: false,
						remoteDigest,
						error:
							"Local image not found. Pull the latest version to check for updates.",
					};
				}

				const hasUpdate = localDigest !== remoteDigest;

				return {
					hasUpdate,
					currentDigest: localDigest,
					remoteDigest,
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
};
