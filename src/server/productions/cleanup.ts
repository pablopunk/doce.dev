import { promises as fs } from "node:fs";
import * as path from "node:path";
import { logger } from "@/server/logger";
import {
	getProductionCurrentSymlink,
	getProductionPath,
} from "@/server/projects/paths";

/**
 * List all deployment hashes for a project, sorted by modification time (newest first).
 */
async function listProductionHashes(projectId: string): Promise<string[]> {
	const projectDir = getProductionPath(projectId);

	try {
		const entries = await fs.readdir(projectDir, { withFileTypes: true });

		// Filter for directories only (exclude symlinks like "current")
		const hashes = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);

		if (hashes.length === 0) {
			return [];
		}

		// Sort by modification time (newest first)
		const hashesWithMtime: Array<[string, number]> = [];
		for (const hash of hashes) {
			const hashPath = path.join(projectDir, hash);
			const stats = await fs.stat(hashPath);
			hashesWithMtime.push([hash, stats.mtimeMs]);
		}

		hashesWithMtime.sort((a, b) => b[1] - a[1]);
		return hashesWithMtime.map(([hash]) => hash);
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			// Directory doesn't exist yet, no hashes
			return [];
		}
		throw error;
	}
}

/**
 * Clean up old production versions, keeping the last N versions.
 * Reads the current symlink to identify which version is active (always keep it).
 * Deletes directories but preserves the symlink.
 *
 * @param projectId - The project ID
 * @param keepCount - Number of versions to keep (default: 2 = current + 1 for rollback)
 */
export async function cleanupOldProductionVersions(
	projectId: string,
	keepCount: number = 2,
): Promise<void> {
	logger.debug({ projectId, keepCount }, "Cleaning up old production versions");

	try {
		const hashes = await listProductionHashes(projectId);
		if (hashes.length <= keepCount) {
			logger.debug(
				{ projectId, count: hashes.length, keepCount },
				"Not enough versions to cleanup",
			);
			return;
		}

		// Get current hash from symlink to ensure we never delete it
		const symlinkPath = getProductionCurrentSymlink(projectId);
		let currentHash: string | null = null;
		try {
			currentHash = await fs.readlink(symlinkPath);
		} catch (error) {
			if (
				error instanceof Error &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				// Symlink doesn't exist yet, safe to delete oldest
				currentHash = null;
			} else {
				throw error;
			}
		}

		// Delete all but the last keepCount versions, never deleting the current one
		const toDelete = hashes.slice(keepCount);
		for (const hash of toDelete) {
			// Never delete the current/active version
			if (hash === currentHash) {
				logger.debug(
					{ projectId, hash },
					"Skipping deletion of current production hash",
				);
				continue;
			}

			const hashPath = getProductionPath(projectId, hash);
			try {
				await fs.rm(hashPath, { recursive: true, force: true });
				logger.info(
					{ projectId, hash, path: hashPath },
					"Deleted old production version",
				);
			} catch (error) {
				logger.error(
					{ projectId, hash, error },
					"Failed to delete old production version",
				);
				// Continue with next version despite error
			}
		}
	} catch (error) {
		logger.error({ projectId, error }, "Error during production cleanup");
		// Don't throw - cleanup failure shouldn't block other operations
	}
}

/**
 * Get list of available production versions with metadata.
 * Useful for rollback and history features.
 */
export async function getProductionVersions(projectId: string): Promise<
	Array<{
		hash: string;
		isActive: boolean;
		mtimeMs: number;
		mtimeIso: string;
	}>
> {
	const projectDir = getProductionPath(projectId);

	try {
		const entries = await fs.readdir(projectDir, { withFileTypes: true });

		// Filter for directories only
		const hashes = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);

		// Get current hash
		const symlinkPath = getProductionCurrentSymlink(projectId);
		let currentHash: string | null = null;
		try {
			currentHash = await fs.readlink(symlinkPath);
		} catch {
			// Symlink doesn't exist
		}

		// Get metadata for each version
		const versions = await Promise.all(
			hashes.map(async (hash) => {
				const hashPath = path.join(projectDir, hash);
				const stats = await fs.stat(hashPath);
				return {
					hash,
					isActive: hash === currentHash,
					mtimeMs: stats.mtimeMs,
					mtimeIso: new Date(stats.mtimeMs).toISOString(),
				};
			}),
		);

		// Sort by mtime, newest first
		versions.sort((a, b) => b.mtimeMs - a.mtimeMs);
		return versions;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return [];
		}
		throw error;
	}
}
