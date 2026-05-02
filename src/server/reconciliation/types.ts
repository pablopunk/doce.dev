/**
 * Types for the self-healing reconciliation system
 */

export type EntityType = "project" | "queueJob" | "opencode" | "docker";

export type ViolationType =
	// Project violations
	| "project.desiredNotObserved"
	| "project.stuck.starting"
	| "project.stuck.stopping"
	| "project.stuck.deleting"
	| "project.container.missing"
	| "project.container.unhealthy"
	| "project.filesystem.missing"
	| "project.session.lost"
	| "project.agent.stuck"
	// Queue violations
	| "queue.job.orphaned"
	| "queue.job.impossible"
	| "queue.dedupe.leak"
	| "queue.job.stale"
	// OpenCode violations
	| "opencode.runtime.unhealthy"
	| "opencode.runtime.crashed"
	| "opencode.session.missing"
	// Docker violations
	| "docker.network.missing"
	| "docker.volume.missing";

export type HealAction =
	// Project healing
	| "project.updateStatus"
	| "project.enqueueRestart"
	| "project.enqueueDelete"
	| "project.enqueueRecreateSession"
	// Queue healing
	| "queue.reset.orphaned"
	| "queue.fail.impossible"
	| "queue.clear.dedupe"
	| "queue.delete.stale"
	// OpenCode healing
	| "opencode.restart"
	| "opencode.recreateSession"
	// Docker healing
	| "docker.createNetwork"
	| "docker.createVolume";

export interface Violation {
	entityType: EntityType;
	entityId: string;
	violationType: ViolationType;
	description: string;
	severity: "low" | "medium" | "high";
	suggestedAction: HealAction;
	context: Record<string, unknown>;
}

export interface HealingAction {
	violationId: string;
	action: HealAction;
	timestamp: Date;
	success: boolean;
	error?: string;
}

export interface ReconciliationReport {
	startedAt: Date;
	completedAt: Date;
	durationMs: number;
	violationsFound: Violation[];
	actionsApplied: HealingAction[];
	summary: {
		projectsScanned: number;
		projectsWithViolations: number;
		queueJobsScanned: number;
		queueJobsHealed: number;
	};
}
