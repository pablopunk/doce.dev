import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { type NewProject, type Project, projects } from "@/server/db/schema";
import type { OpencodeDiagnostic } from "@/server/opencode/diagnostics";

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
 * Map legacy status to desired status for backward compatibility.
 */
function statusToDesired(status: ProjectStatus): string {
	switch (status) {
		case "created":
			return "created";
		case "starting":
			return "running";
		case "running":
			return "running";
		case "stopping":
			return "stopped";
		case "stopped":
			return "stopped";
		case "error":
			return "running"; // Assume user wants it running
		case "deleting":
			return "deleting";
	}
}

/**
 * Update a project's status.
 * Also updates desired_status for the new self-healing system.
 */
export async function updateProjectStatus(
	id: string,
	status: ProjectStatus,
): Promise<void> {
	const desiredStatus = statusToDesired(status) as Project["desiredStatus"];
	await db
		.update(projects)
		.set({ status, desiredStatus })
		.where(eq(projects.id, id));
}

/**
 * Update project preferred model in DB.
 */
export async function updateProjectIdentity(
	id: string,
	identity: { name: string; icon: string; slug: string },
): Promise<void> {
	await db.update(projects).set(identity).where(eq(projects.id, id));
}

/**
 * Update only the display name and icon (not slug).
 */
export async function updateProjectDisplayIdentity(
	id: string,
	identity: { name: string; icon: string },
): Promise<void> {
	await db.update(projects).set(identity).where(eq(projects.id, id));
}

export async function updateProjectModelInDb(
	id: string,
	model: string | null,
): Promise<void> {
	await db
		.update(projects)
		.set({ preferredModel: model })
		.where(eq(projects.id, id));
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
 * Reset prompt/session tracking when runtime session state is lost.
 * This allows bootstrap flow to recreate a session and resend the project prompt.
 */
export async function resetPromptStateForSessionRecovery(
	id: string,
): Promise<void> {
	await db
		.update(projects)
		.set({
			initialPromptSent: false,
			initialPromptCompleted: false,
			userPromptCompleted: false,
			userPromptMessageId: null,
		})
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

export async function updateProjectOpencodeError(
	id: string,
	diagnostic: OpencodeDiagnostic,
): Promise<void> {
	await db
		.update(projects)
		.set({
			opencodeErrorCategory: diagnostic.category,
			opencodeErrorCode: diagnostic.technicalDetails?.errorName ?? null,
			opencodeErrorMessage: diagnostic.message,
			opencodeErrorSource: diagnostic.source,
			opencodeErrorAt: new Date(),
		})
		.where(eq(projects.id, id));
}

export async function clearProjectOpencodeError(id: string): Promise<void> {
	await db
		.update(projects)
		.set({
			opencodeErrorCategory: null,
			opencodeErrorCode: null,
			opencodeErrorMessage: null,
			opencodeErrorSource: null,
			opencodeErrorAt: null,
		})
		.where(eq(projects.id, id));
}
