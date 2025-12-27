import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * Calculate SHA256 hash of all files in a directory recursively.
 * Files are processed in alphabetical order for deterministic hashing.
 * Returns the first 8 characters of the hash for readability.
 *
 * @param dirPath - Absolute path to directory to hash
 * @returns 8-character hash (hex)
 */
export async function hashDistFolder(dirPath: string): Promise<string> {
	const hash = createHash("sha256");

	// Recursively get all files in sorted order
	const files = await getAllFilesSorted(dirPath);

	for (const file of files) {
		const filePath = path.join(dirPath, file);
		const content = await fs.readFile(filePath);
		hash.update(content);
	}

	return hash.digest("hex").slice(0, 8);
}

/**
 * Recursively get all files in a directory, sorted alphabetically.
 * Relative paths are returned with forward slashes.
 *
 * @param dirPath - Absolute path to directory
 * @param prefix - Internal use: prefix for recursive calls
 * @returns Sorted array of relative file paths
 */
async function getAllFilesSorted(
	dirPath: string,
	prefix: string = "",
): Promise<string[]> {
	const entries = await fs.readdir(dirPath, { withFileTypes: true });
	const files: string[] = [];

	// Sort entries alphabetically
	entries.sort((a, b) => a.name.localeCompare(b.name));

	for (const entry of entries) {
		const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			// Recursively get files from subdirectory
			const subFiles = await getAllFilesSorted(
				path.join(dirPath, entry.name),
				relativePath,
			);
			files.push(...subFiles);
		} else {
			files.push(relativePath);
		}
	}

	return files;
}
