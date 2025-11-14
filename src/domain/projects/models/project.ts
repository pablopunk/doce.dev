/**
 * Project domain model
 * Handles all project-related business logic and data access
 */

import * as db from "@/lib/db";
import type {
	ProjectInDatabase,
	FileInDatabase,
} from "@/lib/db/providers/drizzle/schema";
import { filterIgnoredFiles } from "../lib/file-filters";
import { listProjectFiles, readProjectFile } from "@/lib/file-system";

// Domain types - always import from here, never from @/lib/db
export type ProjectData = ProjectInDatabase;
export type FileData = FileInDatabase;
export type NewProjectData = {
	id: string;
	name: string;
	description?: string | null;
};

export interface ProjectWithFiles extends ProjectData {
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
	static async getAll(): Promise<ProjectData[]> {
		return db.projects.getAll();
	}

	/**
	 * Get a project by ID
	 */
	static async getById(id: string): Promise<ProjectData | null> {
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

		// Read files from filesystem (not DB) - filesystem is source of truth
		const filePaths = await listProjectFiles(id);
		const filesWithContent = await Promise.all(
			filePaths.map(async (path) => {
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

		const files = filterIgnoredFiles(filesWithContent);
		return { ...project, files };
	}

	/**
	 * Create a new project
	 */
	static async create(
		name: string,
		description?: string,
	): Promise<ProjectData> {
		const id = crypto.randomUUID();
		const project = db.projects.create({ id, name, description });
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
	): Promise<ProjectData> {
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
	): Promise<ProjectData> {
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
		data: Partial<Pick<ProjectData, "name" | "description" | "status">>,
	): Promise<ProjectData> {
		const updated = db.projects.update(id, data);
		if (!updated) throw new Error(`Project ${id} not found`);
		return updated;
	}

	/**
	 * Generic update method for any fields
	 */
	static async updateFields(
		id: string,
		fields: Partial<ProjectData>,
	): Promise<ProjectData> {
		const updated = db.projects.update(id, fields);
		if (!updated) throw new Error(`Project ${id} not found`);
		return updated;
	}

	/**
	 * Append a log line to project build logs
	 * Business logic for managing build logs
	 */
	static async appendBuildLog(id: string, logLine: string): Promise<void> {
		const project = db.projects.getById(id);
		if (!project) {
			throw new Error(`Project ${id} not found`);
		}

		const currentLogs = project.buildLogs || "";
		const newLogs = currentLogs + logLine;

		db.projects.update(id, { buildLogs: newLogs });
	}

	/**
	 * Clear build logs for a project
	 */
	static async clearBuildLogs(id: string): Promise<void> {
		db.projects.update(id, { buildLogs: null });
	}
}
