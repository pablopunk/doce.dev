import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { type NewProject, type Project, projects } from "@/server/db/schema";

export type ProjectStatus = Project["status"];

/**
 * Create a new project in the database.
 */
export async function createProject(data: NewProject): Promise<Project> {
	const result = await db.insert(projects).values(data).returning();
	const project = result[0];
	if (!project) {
		throw new Error("Failed to create project");
	}
	return project;
}

/**
 * Get a project by ID (excludes soft-deleted projects).
 */
export async function getProjectById(id: string): Promise<Project | null> {
	const result = await db
		.select()
		.from(projects)
		.where(and(eq(projects.id, id), isNull(projects.deletedAt)))
		.limit(1);

	return result[0] ?? null;
}

/**
 * Get a project by ID regardless of deletion status.
 */
export async function getProjectByIdIncludeDeleted(
	id: string,
): Promise<Project | null> {
	const result = await db
		.select()
		.from(projects)
		.where(eq(projects.id, id))
		.limit(1);

	return result[0] ?? null;
}

/**
 * Get all projects for a user (excludes soft-deleted projects and projects being deleted).
 */
export async function getProjectsByUserId(userId: string): Promise<Project[]> {
	return db
		.select()
		.from(projects)
		.where(
			and(
				eq(projects.ownerUserId, userId),
				isNull(projects.deletedAt),
				ne(projects.status, "deleting"),
			),
		)
		.orderBy(desc(projects.createdAt));
}

/**
 * Update a project's status.
 */
export async function updateProjectStatus(
	id: string,
	status: ProjectStatus,
): Promise<void> {
	await db.update(projects).set({ status }).where(eq(projects.id, id));
}

/**
 * Update project model in DB.
 */
export async function updateProjectModelInDb(
	_id: string,
	_model: string | null,
): Promise<void> {
	// Note: The schema doesn't seem to have a 'model' field in projects table?
	// Checking schema... it doesn't. It's stored in opencode.json.
}

/**
 * Soft-delete a project by setting deletedAt.
 */
export async function softDeleteProject(id: string): Promise<void> {
	await db
		.update(projects)
		.set({ deletedAt: new Date() })
		.where(eq(projects.id, id));
}

/**
 * Hard-delete a project from the database.
 */
export async function hardDeleteProject(id: string): Promise<void> {
	await db.delete(projects).where(eq(projects.id, id));
}

/**
 * Check if a project belongs to a user.
 */
export async function isProjectOwnedByUser(
	projectId: string,
	userId: string,
): Promise<boolean> {
	const result = await db
		.select({ id: projects.id })
		.from(projects)
		.where(
			and(
				eq(projects.id, projectId),
				eq(projects.ownerUserId, userId),
				isNull(projects.deletedAt),
			),
		)
		.limit(1);

	return result.length > 0;
}

/**
 * Get all running projects (for shutdown/cleanup).
 */
export async function getRunningProjects(): Promise<Project[]> {
	return db
		.select()
		.from(projects)
		.where(and(eq(projects.status, "running"), isNull(projects.deletedAt)));
}

/**
 * Mark a project's initial prompt as sent.
 */
export async function markInitialPromptSent(id: string): Promise<void> {
	await db
		.update(projects)
		.set({ initialPromptSent: true })
		.where(eq(projects.id, id));
}

/**
 * Mark a project's initial prompt as completed (finished execution).
 */
export async function markInitialPromptCompleted(id: string): Promise<void> {
	await db
		.update(projects)
		.set({ initialPromptCompleted: true })
		.where(eq(projects.id, id));
}

/**
 * Update a project's bootstrap session ID.
 */
export async function updateBootstrapSessionId(
	id: string,
	sessionId: string,
): Promise<void> {
	await db
		.update(projects)
		.set({ bootstrapSessionId: sessionId })
		.where(eq(projects.id, id));
}

/**
 * Update the user prompt message ID for a project.
 */
export async function updateUserPromptMessageId(
	id: string,
	messageId: string,
): Promise<void> {
	await db
		.update(projects)
		.set({ userPromptMessageId: messageId })
		.where(eq(projects.id, id));
}

/**
 * Mark the user prompt as completed (when it goes idle).
 */
export async function markUserPromptCompleted(id: string): Promise<void> {
	await db
		.update(projects)
		.set({
			userPromptCompleted: true,
			initialPromptCompleted: true,
		})
		.where(eq(projects.id, id));
}
