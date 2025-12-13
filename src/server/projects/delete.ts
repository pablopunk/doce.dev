import * as fs from "node:fs/promises";
import { logger } from "@/server/logger";
import {
  getProjectById,
  hardDeleteProject,
  updateProjectStatus,
  getProjectsByUserId,
} from "./projects.model";
import { composeDownWithVolumes } from "@/server/docker/compose";
import { getProjectPath } from "./create";
import {
  markProjectDeleting,
  removeProjectPresence,
} from "@/server/presence/manager";

export interface DeleteProjectResult {
  success: boolean;
  error?: string;
}

/**
 * Delete a project completely.
 * This handles:
 * 1. Mark project as deleting in presence manager
 * 2. Stop and remove Docker containers + volumes
 * 3. Delete project directory
 * 4. Remove DB record
 * 5. Clean up presence tracking
 */
export async function deleteProject(
  projectId: string
): Promise<DeleteProjectResult> {
  logger.info({ projectId }, "Deleting project");

  // Get project from DB
  const project = await getProjectById(projectId);
  if (!project) {
    return { success: false, error: "Project not found" };
  }

  // Mark as deleting to prevent new starts
  markProjectDeleting(projectId);

  const projectPath = getProjectPath(projectId);

  // Update status to indicate deletion in progress
  try {
    await updateProjectStatus(projectId, "stopping");
  } catch {
    // Ignore status update errors
  }

  // Stop and remove Docker containers
  try {
    await composeDownWithVolumes(projectId, projectPath);
    logger.debug({ projectId }, "Docker compose down completed");
  } catch (err) {
    logger.warn(
      { error: err, projectId },
      "Failed to stop Docker containers (continuing with deletion)"
    );
    // Continue with deletion even if Docker fails
  }

  // Delete project directory
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
    logger.debug({ projectId, projectPath }, "Deleted project directory");
  } catch (err) {
    logger.warn(
      { error: err, projectId },
      "Failed to delete project directory (continuing with DB deletion)"
    );
    // Continue with DB deletion even if directory deletion fails
  }

  // Remove from database
  try {
    await hardDeleteProject(projectId);
    logger.info({ projectId }, "Project deleted from database");
  } catch (err) {
    logger.error(
      { error: err, projectId },
      "Failed to delete project from database"
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete from database",
    };
  }

  // Clean up presence tracking
  removeProjectPresence(projectId);

  return { success: true };
}

/**
 * Delete all projects for a user.
 */
export async function deleteAllProjectsForUser(
  userId: string
): Promise<{ success: boolean; deleted: number; errors: string[] }> {
  logger.info({ userId }, "Deleting all projects for user");

  const projects = await getProjectsByUserId(userId);
  const errors: string[] = [];
  let deleted = 0;

  for (const project of projects) {
    const result = await deleteProject(project.id);
    if (result.success) {
      deleted++;
    } else {
      errors.push(`Failed to delete ${project.name}: ${result.error}`);
    }
  }

  logger.info({ userId, deleted, errors: errors.length }, "Finished deleting all projects");

  return { success: errors.length === 0, deleted, errors };
}

/**
 * Stop a project's containers without deleting.
 */
export async function stopProject(projectId: string): Promise<DeleteProjectResult> {
  logger.info({ projectId }, "Stopping project");

  const project = await getProjectById(projectId);
  if (!project) {
    return { success: false, error: "Project not found" };
  }

  const projectPath = getProjectPath(projectId);

  try {
    await updateProjectStatus(projectId, "stopping");
    
    // Import composeDown to avoid circular dependency
    const { composeDown } = await import("@/server/docker/compose");
    const result = await composeDown(projectId, projectPath);

    if (result.success) {
      await updateProjectStatus(projectId, "stopped");
      logger.info({ projectId }, "Project stopped");
      return { success: true };
    } else {
      await updateProjectStatus(projectId, "error");
      return {
        success: false,
        error: `Docker compose down failed: ${result.stderr.slice(0, 200)}`,
      };
    }
  } catch (err) {
    await updateProjectStatus(projectId, "error");
    logger.error({ error: err, projectId }, "Failed to stop project");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error stopping project",
    };
  }
}
