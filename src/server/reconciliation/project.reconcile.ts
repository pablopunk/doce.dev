/**
 * Project self-healing reconciliation
 *
 * Detects and fixes:
 * - Status mismatches (desired vs observed)
 * - Stuck states (e.g., stuck in "starting" for hours)
 * - Missing containers or filesystems
 * - Stale OpenCode sessions
 * - Stuck agent processing
 */

import { eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import type { Project } from "@/server/db/schema";
import { projects } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { checkPreviewReady } from "@/server/projects/health";
import { enqueueDockerEnsureRunning } from "@/server/queue/enqueue";
import { getRunningJobForProject } from "@/server/queue/queue.claim";
import type { HealingAction, Violation } from "./types";

const STUCK_STARTING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const STUCK_DELETING_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const AGENT_STUCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Check if a project's desired and observed states are in sync.
 */
async function checkProjectHealthSync(project: Project): Promise<{
	violations: Violation[];
	actions: HealingAction[];
}> {
	const violations: Violation[] = [];
	const actions: HealingAction[] = [];
	const now = new Date();

	// Check if container is healthy
	let containerHealthy = false;
	try {
		containerHealthy = await checkPreviewReady(project.id);
	} catch (error) {
		logger.debug(
			{ projectId: project.id, error },
			"Failed to check container health",
		);
	}

	// Update observed status
	const newObservedStatus = containerHealthy ? "healthy" : "unhealthy";
	if (project.observedStatus !== newObservedStatus) {
		await db
			.update(projects)
			.set({ observedStatus: newObservedStatus, lastReconciledAt: now })
			.where(eq(projects.id, project.id));
	}

	// Check for violations
	switch (project.desiredStatus) {
		case "running":
			if (!containerHealthy) {
				violations.push({
					entityType: "project",
					entityId: project.id,
					violationType: "project.desiredNotObserved",
					description: `Project ${project.name} is desired=running but observed=unhealthy`,
					severity: "high",
					suggestedAction: "project.enqueueRestart",
					context: {
						projectId: project.id,
						desiredStatus: project.desiredStatus,
						observedStatus: newObservedStatus,
					},
				});

				// Heal: enqueue restart
				try {
					await enqueueDockerEnsureRunning({
						projectId: project.id,
						reason: "presence",
					});
					actions.push({
						violationId: `${project.id}:project.desiredNotObserved`,
						action: "project.enqueueRestart",
						timestamp: now,
						success: true,
					});
				} catch (error) {
					logger.error(
						{ projectId: project.id, error },
						"Failed to enqueue restart for unhealthy project",
					);
					actions.push({
						violationId: `${project.id}:project.desiredNotObserved`,
						action: "project.enqueueRestart",
						timestamp: now,
						success: false,
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}
			break;

		case "stopped":
			if (containerHealthy) {
				// Container is running but we want it stopped
				// This is less critical, log it but don't auto-fix yet
				violations.push({
					entityType: "project",
					entityId: project.id,
					violationType: "project.container.unhealthy",
					description: `Project ${project.name} is desired=stopped but container is running`,
					severity: "low",
					suggestedAction: "project.updateStatus",
					context: {
						projectId: project.id,
						desiredStatus: project.desiredStatus,
						observedStatus: newObservedStatus,
					},
				});
			}
			break;

		case "deleting":
			if (project.createdAt) {
				const age = now.getTime() - project.createdAt.getTime();
				if (age > STUCK_DELETING_TIMEOUT_MS) {
					// Stuck in deleting for too long
					const hasActiveJob = await getRunningJobForProject(project.id);
					if (!hasActiveJob) {
						violations.push({
							entityType: "project",
							entityId: project.id,
							violationType: "project.stuck.deleting",
							description: `Project ${project.name} stuck in deleting for ${age}ms`,
							severity: "high",
							suggestedAction: "project.enqueueDelete",
							context: {
								projectId: project.id,
								stuckForMs: age,
							},
						});

						// Log but don't auto-delete - let admin handle
						logger.error(
							{ projectId: project.id },
							"Project stuck in deleting, manual intervention needed",
						);
					}
				}
			}
			break;
	}

	// Check for stuck starting
	if (
		project.desiredStatus === "running" &&
		project.status === "starting" &&
		project.createdAt
	) {
		const age = now.getTime() - project.createdAt.getTime();
		if (age > STUCK_STARTING_TIMEOUT_MS) {
			const hasActiveJob = await getRunningJobForProject(project.id);
			if (!hasActiveJob) {
				violations.push({
					entityType: "project",
					entityId: project.id,
					violationType: "project.stuck.starting",
					description: `Project ${project.name} stuck in starting for ${age}ms with no active jobs`,
					severity: "high",
					suggestedAction: "project.enqueueRestart",
					context: {
						projectId: project.id,
						stuckForMs: age,
					},
				});
			}
		}
	}

	// Check for stuck agent
	if (
		project.bootstrapAgentStatus === "processing" &&
		project.bootstrapAgentLastActivityAt
	) {
		const timeSinceLastActivity =
			now.getTime() - project.bootstrapAgentLastActivityAt.getTime();
		if (timeSinceLastActivity > AGENT_STUCK_TIMEOUT_MS) {
			violations.push({
				entityType: "project",
				entityId: project.id,
				violationType: "project.agent.stuck",
				description: `Agent processing for ${timeSinceLastActivity}ms with no activity`,
				severity: "medium",
				suggestedAction: "project.enqueueRestart",
				context: {
					projectId: project.id,
					noActivityForMs: timeSinceLastActivity,
				},
			});

			// Mark as stuck and reset for restart
			await db
				.update(projects)
				.set({
					bootstrapAgentStatus: "error",
					bootstrapAgentLastActivityAt: now,
				})
				.where(eq(projects.id, project.id));
		}
	}

	return { violations, actions };
}

/**
 * Reconcile all non-deleted projects.
 */
export async function reconcileProjects(): Promise<{
	violations: Violation[];
	actions: HealingAction[];
}> {
	const allViolations: Violation[] = [];
	const allActions: HealingAction[] = [];

	// Get all non-deleted projects
	const allProjects = await db
		.select()
		.from(projects)
		.where(isNull(projects.deletedAt));

	logger.debug({ count: allProjects.length }, "Reconciling projects");

	for (const project of allProjects) {
		const { violations, actions } = await checkProjectHealthSync(project);
		allViolations.push(...violations);
		allActions.push(...actions);
	}

	return {
		violations: allViolations,
		actions: allActions,
	};
}
