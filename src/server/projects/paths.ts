import * as path from "node:path";
import { isComposeV1 } from "@/server/docker/composeVersion";

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

export function getGlobalOpencodeConfigPath(): string {
	return path.join(getDataPath(), "opencode", "opencode.json");
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
 * Get the absolute path to the preview directory for a project.
 */
export function getProjectPreviewPath(projectId: string): string {
	return path.join(getProjectPath(projectId), "preview");
}

export function getProjectPreviewPathFromRoot(
	projectPathOnDisk: string,
): string {
	return path.join(normalizeProjectPath(projectPathOnDisk), "preview");
}

export function getProjectPreviewOpencodePath(projectId: string): string {
	return path.join(getProjectPreviewPath(projectId), "opencode.json");
}

/**
 * Get the absolute path to the production directory for a project.
 */
export function getProjectProductionPath(
	projectId: string,
	hash?: string,
): string {
	const basePath = path.join(getProjectPath(projectId), "production");
	return hash ? path.join(basePath, hash) : basePath;
}

/**
 * Get the relative path on disk for a project (stored in DB).
 */
export function getProjectRelativePath(projectId: string): string {
	return `${DATA_DIR}/${PROJECTS_DIR}/${projectId}`;
}

/**
 * Get the absolute path to the productions directory.
 * @deprecated Production is now in project/[projectId]/production/
 */
export function getProductionsPath(): string {
	return path.join(getDataPath(), PRODUCTIONS_DIR);
}

/**
 * Get the absolute path to a specific production directory.
 * If hash is provided, returns the versioned hash directory inside the production folder.
 * If hash is omitted, returns the production directory for the project.
 *
 * @param projectId - The project ID
 * @param hash - Optional: 8-character hash for versioned directory
 * @returns Absolute path to production directory
 */
export function getProductionPath(projectId: string, hash?: string): string {
	const basePath = path.join(getProjectPath(projectId), "production");
	return hash ? path.join(basePath, hash) : basePath;
}

/**
 * Get the absolute path to the production "current" symlink.
 * This symlink points to the active deployment hash directory.
 *
 * @param projectId - The project ID
 * @returns Absolute path to current symlink
 */
export function getProductionCurrentSymlink(projectId: string): string {
	return path.join(getProjectProductionPath(projectId), "current");
}

/**
 * Get the relative path on disk for production (for reference).
 */
export function getProductionRelativePath(
	projectId: string,
	hash?: string,
): string {
	const basePath = `${DATA_DIR}/${PROJECTS_DIR}/${projectId}/production`;
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

/**
 * Get the Docker Compose project name for a project.
 * Used as prefix for all containers in the project.
 */
export function getDockerProjectName(projectId: string): string {
	return `doce_${projectId}`;
}

/**
 * Get the separator used in container names.
 * Docker Compose v1 uses underscores, v2 uses hyphens.
 */
function composeSeparator(): string {
	return isComposeV1() ? "_" : "-";
}

/**
 * Get the container name for the preview service.
 * Docker Compose v1: {project}_{service}_{instance}
 * Docker Compose v2: {project}-{service}-{instance}
 */
export function getPreviewContainerName(projectId: string): string {
	const sep = composeSeparator();
	return `${getDockerProjectName(projectId)}${sep}preview${sep}1`;
}

/**
 * Get the container name for the OpenCode agent service.
 */
export function getOpencodeContainerName(projectId: string): string {
	const sep = composeSeparator();
	return `${getDockerProjectName(projectId)}${sep}opencode${sep}1`;
}

/**
 * Get the hostname for the preview service within the Docker network.
 * Same as container name since Docker DNS uses container names.
 */
export function getPreviewHostname(projectId: string): string {
	return getPreviewContainerName(projectId);
}

/**
 * Get the container name for the production service.
 * Uses explicit naming via `docker run --name`.
 */
export function getProductionContainerName(projectId: string): string {
	return `doce-prod-${projectId}`;
}

/**
 * Get the Docker image name for a production build.
 */
export function getProductionImageName(
	projectId: string,
	hash: string,
): string {
	return `doce-prod-${projectId}-${hash}`;
}
