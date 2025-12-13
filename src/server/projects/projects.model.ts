import { db } from "@/server/db/client";
import { projects, type Project, type NewProject } from "@/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

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
  id: string
): Promise<Project | null> {
  const result = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all projects for a user (excludes soft-deleted projects).
 */
export async function getProjectsByUserId(userId: string): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerUserId, userId), isNull(projects.deletedAt)))
    .orderBy(desc(projects.createdAt));
}

/**
 * Update a project's status.
 */
export async function updateProjectStatus(
  id: string,
  status: ProjectStatus
): Promise<void> {
  await db.update(projects).set({ status }).where(eq(projects.id, id));
}

/**
 * Update project model.
 */
export async function updateProjectModel(
  id: string,
  model: string | null
): Promise<void> {
  await db.update(projects).set({ model }).where(eq(projects.id, id));
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
  userId: string
): Promise<boolean> {
  const result = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.ownerUserId, userId),
        isNull(projects.deletedAt)
      )
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
    .where(
      and(eq(projects.status, "running"), isNull(projects.deletedAt))
    );
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
