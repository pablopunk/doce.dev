import * as path from "node:path";

// Paths relative to project root
const DATA_DIR = "data";
const PROJECTS_DIR = "projects";
const PRODUCTIONS_DIR = "productions";
const TEMPLATE_DIR = "templates/astro-starter";

const DEFAULT_DATA_PATH = path.join(process.cwd(), DATA_DIR);
const DATA_ROOT = process.env.DOCE_DATA_DIR
	? path.resolve(process.env.DOCE_DATA_DIR)
	: DEFAULT_DATA_PATH;

/**
 * Get the absolute path to the data directory.
 */
export function getOpencodePath(): string {
	return path.join(getDataPath(), "opencode", "auth.json");
}

export function getDataPath(): string {
	return DATA_ROOT;
}

/**
 * Get the absolute path to the projects directory.
 */
export function getProjectsPath(): string {
	return path.join(getDataPath(), PROJECTS_DIR);
}

/**
 * Get the absolute path to the template directory.
 */
export function getTemplatePath(): string {
	return path.join(process.cwd(), TEMPLATE_DIR);
}

/**
 * Get the absolute path to a specific project.
 */
export function getProjectPath(projectId: string): string {
	return path.join(getProjectsPath(), projectId);
}

/**
 * Get the relative path on disk for a project (stored in DB).
 */
export function getProjectRelativePath(projectId: string): string {
	return `${DATA_DIR}/${PROJECTS_DIR}/${projectId}`;
}

/**
 * Get the absolute path to the productions directory.
 */
export function getProductionsPath(): string {
	return path.join(getDataPath(), PRODUCTIONS_DIR);
}

/**
 * Get the absolute path to a specific production directory.
 * If hash is provided, returns the versioned hash directory.
 * If hash is omitted, returns the project-level directory containing all versions.
 *
 * @param projectId - The project ID
 * @param hash - Optional: 8-character hash for versioned directory
 * @returns Absolute path to production directory
 */
export function getProductionPath(projectId: string, hash?: string): string {
	const projectPath = path.join(getProductionsPath(), projectId);
	return hash ? path.join(projectPath, hash) : projectPath;
}

/**
 * Get the absolute path to the production "current" symlink.
 * This symlink points to the active deployment hash directory.
 *
 * @param projectId - The project ID
 * @returns Absolute path to current symlink
 */
export function getProductionCurrentSymlink(projectId: string): string {
	return path.join(getProductionsPath(), projectId, "current");
}

/**
 * Get the relative path on disk for production (for reference).
 */
export function getProductionRelativePath(
	projectId: string,
	hash?: string,
): string {
	const basePath = `${DATA_DIR}/${PRODUCTIONS_DIR}/${projectId}`;
	return hash ? `${basePath}/${hash}` : basePath;
}

export function normalizeProjectPath(projectPathOnDisk: string): string {
	if (path.isAbsolute(projectPathOnDisk)) {
		return projectPathOnDisk;
	}

	const trimmed = projectPathOnDisk.startsWith(`${DATA_DIR}/`)
		? projectPathOnDisk.slice(DATA_DIR.length + 1)
		: projectPathOnDisk;

	return path.join(getDataPath(), trimmed);
}
