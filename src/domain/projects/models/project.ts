/**
 * Project domain model
 * Handles all project-related business logic and data access
 */

import * as db from "@/lib/db";

export interface ProjectData {
	id: string;
	name: string;
	description?: string;
	created_at: string;
	updated_at: string;
	user_id?: string;
	status: "draft" | "preview" | "deployed" | "building" | "error";
	preview_url?: string | null;
	deployed_url?: string | null;
}

export interface FileData {
	id: string;
	project_id: string;
	file_path: string;
	content: string;
	created_at: string;
	updated_at: string;
}

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
		return db.getProjects() as ProjectData[];
	}

	/**
	 * Get a project by ID
	 */
	static async getById(id: string): Promise<ProjectData | null> {
		const project = db.getProject(id);
		return project ? (project as ProjectData) : null;
	}

	/**
	 * Get a project with its files
	 */
	static async getWithFiles(id: string): Promise<ProjectWithFiles | null> {
		const project = await Project.getById(id);
		if (!project) return null;

		const files = db.getFiles(id) as FileData[];
		return { ...project, files };
	}

	/**
	 * Create a new project
	 */
	static async create(
		name: string,
		description?: string,
	): Promise<ProjectData> {
		const project = db.createProject(name, description);
		return project as ProjectData;
	}

	/**
	 * Delete a project
	 */
	static async delete(id: string): Promise<void> {
		db.deleteProject(id);
	}

	/**
	 * Update project preview URL and status
	 */
	static async updatePreview(
		id: string,
		previewUrl: string | null,
	): Promise<ProjectData> {
		const updates: any = {
			preview_url: previewUrl,
			status: previewUrl ? "preview" : "draft",
		};

		const updated = db.updateProject(id, updates);
		return updated as ProjectData;
	}

	/**
	 * Update project deployment URL and status
	 */
	static async updateDeployment(
		id: string,
		deployedUrl: string,
	): Promise<ProjectData> {
		const updates: any = {
			deployed_url: deployedUrl,
			status: "deployed",
		};

		const updated = db.updateProject(id, updates);
		return updated as ProjectData;
	}

	/**
	 * Update project details
	 */
	static async update(
		id: string,
		data: Partial<Pick<ProjectData, "name" | "description" | "status">>,
	): Promise<ProjectData> {
		const updated = db.updateProject(id, data);
		return updated as ProjectData;
	}

	/**
	 * Generic update method for any fields
	 */
	static async updateFields(
		id: string,
		fields: Partial<ProjectData>,
	): Promise<ProjectData> {
		const updated = db.updateProject(id, fields);
		return updated as ProjectData;
	}
}
