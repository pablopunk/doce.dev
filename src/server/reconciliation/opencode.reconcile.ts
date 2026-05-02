/**
 * OpenCode runtime self-healing reconciliation
 *
 * Detects and fixes:
 * - Runtime crashed or unhealthy
 * - Sessions lost between DB and runtime
 */

import { eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projects } from "@/server/db/schema";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import {
	isGlobalOpencodeHealthy,
	restartGlobalOpencode,
} from "@/server/opencode/runtime";
import { getProjectPreviewPathFromRoot } from "@/server/projects/paths";
import type { HealingAction, Violation } from "./types";

/**
 * Check if the central OpenCode runtime is healthy.
 * If not, restart it.
 */
export async function reconcileOpenCodeRuntime(): Promise<{
	violations: Violation[];
	actions: HealingAction[];
}> {
	const violations: Violation[] = [];
	const actions: HealingAction[] = [];
	const now = new Date();

	const healthy = await isGlobalOpencodeHealthy();

	if (!healthy) {
		violations.push({
			entityType: "opencode",
			entityId: "runtime",
			violationType: "opencode.runtime.unhealthy",
			description: "OpenCode runtime is not responding to health checks",
			severity: "high",
			suggestedAction: "opencode.restart",
			context: {},
		});

		try {
			await restartGlobalOpencode();
			actions.push({
				violationId: "runtime:opencode.runtime.unhealthy",
				action: "opencode.restart",
				timestamp: now,
				success: true,
			});
			logger.info("Restarted OpenCode runtime");
		} catch (error) {
			actions.push({
				violationId: "runtime:opencode.runtime.unhealthy",
				action: "opencode.restart",
				timestamp: now,
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
			logger.error({ error }, "Failed to restart OpenCode runtime");
		}
	}

	return { violations, actions };
}

/**
 * Check if project sessions in DB still exist in the runtime.
 * If a session is lost, reset it so it can be recreated.
 */
export async function reconcileOpenCodeSessions(): Promise<{
	violations: Violation[];
	actions: HealingAction[];
}> {
	const violations: Violation[] = [];
	const actions: HealingAction[] = [];
	const now = new Date();

	// Get all projects with a bootstrap session
	const projectsWithSessions = await db
		.select()
		.from(projects)
		.where(isNull(projects.deletedAt));

	const client = createOpencodeClient();

	for (const project of projectsWithSessions) {
		if (!project.bootstrapSessionId) continue;

		try {
			const projectDir = getProjectPreviewPathFromRoot(project.pathOnDisk);
			const response = await client.session.list({
				directory: projectDir,
			});
			const sessions = response.data ?? [];
			const sessionExists = sessions.some(
				(s: { id?: string }) => s.id === project.bootstrapSessionId,
			);

			if (!sessionExists) {
				violations.push({
					entityType: "opencode",
					entityId: project.id,
					violationType: "opencode.session.missing",
					description: `Project ${project.name} session ${project.bootstrapSessionId} not found in runtime`,
					severity: "medium",
					suggestedAction: "opencode.recreateSession",
					context: {
						projectId: project.id,
						sessionId: project.bootstrapSessionId,
					},
				});

				// Reset prompt state so it can be recreated
				await db
					.update(projects)
					.set({
						initialPromptSent: false,
						initialPromptCompleted: false,
						userPromptCompleted: false,
						userPromptMessageId: null,
					})
					.where(eq(projects.id, project.id));

				actions.push({
					violationId: `${project.id}:opencode.session.missing`,
					action: "opencode.recreateSession",
					timestamp: now,
					success: true,
				});

				logger.warn(
					{ projectId: project.id },
					"Session missing in runtime, reset for recreation",
				);
			}
		} catch (error) {
			logger.debug(
				{ projectId: project.id, error },
				"Failed to check session existence",
			);
		}
	}

	return { violations, actions };
}
