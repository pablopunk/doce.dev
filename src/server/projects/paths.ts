import * as path from "node:path";

// Paths relative to project root
const DATA_DIR = "data";
const PROJECTS_DIR = "projects";
const TEMPLATE_DIR = "templates/astro-starter";

/**
 * Get the absolute path to the data directory.
 */
export function getDataPath(): string {
	return path.join(process.cwd(), DATA_DIR);
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
