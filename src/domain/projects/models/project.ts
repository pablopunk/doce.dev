/**
 * Project domain model
 * Handles all project-related business logic and data access
 */

import * as db from "@/lib/db";
import type { ProjectInDatabase } from "@/lib/db/providers/drizzle/schema";
import { listProjectFiles, readProjectFile } from "@/lib/file-system";
import { filterIgnoredFiles, shouldIgnoreFile } from "../lib/file-filters";

export type ProjectModel = ProjectInDatabase;
export type FileData = {
	id: string;
	projectId: string;
	filePath: string;
	content: string;
	createdAt: string | null;
	updatedAt: string | null;
};
export type NewProjectModel = {
	id: string;
	name: string;
	description?: string | null;
};

export interface ProjectWithFiles extends ProjectModel {
	files: FileData[];
}

/**
 * Project Model
 * Static methods for project operations
 */
export class Project {
	/**
	 * Get all projects
	 */
	static async getAll(): Promise<ProjectModel[]> {
		return db.projects.getAll();
	}

	/**
	 * Get a project by ID
	 */
	static async getById(id: string): Promise<ProjectModel | null> {
		const project = db.projects.getById(id);
		return project ?? null;
	}

	/**
	 * Get a project with its files
	 * Reads files from filesystem (single source of truth)
	 * Applies file filtering (excludes node_modules, build dirs, etc.)
	 */
	static async getWithFiles(id: string): Promise<ProjectWithFiles | null> {
		const project = await Project.getById(id);
		if (!project) return null;

		// Read files from filesystem (not DB) - filesystem is source of truth.
		// This is potentially expensive for large projects, so we:
		// - walk the directory tree once
		// - filter out obviously-ignored paths early
		// - only read file contents for the remaining paths
		const allFilePaths = await listProjectFiles(id);
		const filteredPaths = allFilePaths.filter((p) => !shouldIgnoreFile(p));

		const filesWithContent = await Promise.all(
			filteredPaths.map(async (path) => {
				const content = await readProjectFile(id, path);
				// Create FileData-compatible objects from filesystem
				return {
					id: path, // Use path as ID
					projectId: id,
					filePath: path,
					content: content || "",
					createdAt: null,
					updatedAt: null,
				} as FileData;
			}),
		);

		return { ...project, files: filesWithContent };
	}

	/**
	 * Create a new project
	 */
	static async create(
		name: string,
		description?: string,
		templateId?: string,
	): Promise<ProjectModel> {
		const id = crypto.randomUUID();
		const project = db.projects.create({ id, name, description, templateId });
		if (!project) throw new Error("Failed to create project");
		return project;
	}

	/**
	 * Delete a project
	 */
	static async delete(id: string): Promise<void> {
		db.projects.delete(id);
	}

	/**
	 * Update project preview URL and status
	 */
	static async updatePreview(
		id: string,
		previewUrl: string | null,
	): Promise<ProjectModel> {
		const updated = db.projects.update(id, {
			previewUrl,
			status: previewUrl ? "preview" : "draft",
		});
		if (!updated) throw new Error(`Project ${id} not found`);
		return updated;
	}

	/**
	 * Update project deployment URL and status
	 */
	static async updateDeployment(
		id: string,
		deployedUrl: string,
	): Promise<ProjectModel> {
		const updated = db.projects.update(id, {
			deployedUrl,
			status: "deployed",
		});
		if (!updated) throw new Error(`Project ${id} not found`);
		return updated;
	}

	/**
	 * Update project details
	 */
	static async update(
		id: string,
		data: Partial<Pick<ProjectModel, "name" | "description" | "status">>,
	): Promise<ProjectModel> {
		const updated = db.projects.update(id, data);
		if (!updated) throw new Error(`Project ${id} not found`);
		return updated;
	}

	/**
	 * Generic update method for any fields
	 */
	static async updateFields(
		id: string,
		fields: Partial<ProjectModel>,
	): Promise<ProjectModel> {
		const updated = db.projects.update(id, fields);
		if (!updated) throw new Error(`Project ${id} not found`);
		return updated;
	}

	/**
	 * Append a log line to project build logs
	 * Business logic for managing build logs
	 */
	static async appendBuildLog(id: string, logLine: string): Promise<void> {
		// Legacy helper: keep for backward-compat callers, but delegate to
		// the batched logger so we don't hammer SQLite on every log line.
		await Project.appendBuildLogs(id, [logLine]);
	}

	/**
	 * Append multiple log lines in a single DB write.
	 * Callers that produce lots of logs should batch their writes through this
	 * API instead of calling appendBuildLog in a loop.
	 */
	static async appendBuildLogs(id: string, logLines: string[]): Promise<void> {
		const project = db.projects.getById(id);
		if (!project) {
			throw new Error(`Project ${id} not found`);
		}

		const currentLogs = project.buildLogs || "";
		const newLogs = currentLogs + logLines.join("");

		db.projects.update(id, { buildLogs: newLogs });
	}

	/**
	 * Clear build logs for a project
	 */
	static async clearBuildLogs(id: string): Promise<void> {
		db.projects.update(id, { buildLogs: null });
	}
}
