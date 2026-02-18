/**
 * Service layer definitions for doce.dev
 *
 * Uses Effect's Context.Tag pattern for dependency injection:
 * - Type-safe service interfaces
 * - Layers for constructing services with dependencies
 * - Easy mocking for tests
 */

import { Context, Effect, Layer } from "effect";
import type { Project, QueueJob } from "@/server/db/schema";
import type {
	DockerOperationError,
	ProjectOperationError,
	QueueJobError,
} from "./errors";

// ============================================================================
// Queue Service
// ============================================================================

/**
 * Service interface for queue operations
 */
export class QueueService extends Context.Tag("QueueService")<
	QueueService,
	{
		/**
		 * Claim the next available job from the queue
		 */
		claimNextJob: (options: {
			workerId: string;
			leaseMs: number;
		}) => Effect.Effect<QueueJob | null, QueueJobError>;

		/**
		 * Mark a job as completed successfully
		 */
		completeJob: (
			jobId: string,
			workerId: string,
		) => Effect.Effect<void, QueueJobError>;

		/**
		 * Mark a job as failed with an error message
		 */
		failJob: (
			jobId: string,
			workerId: string,
			errorMessage: string,
		) => Effect.Effect<void, QueueJobError>;

		/**
		 * Send a heartbeat to extend the job lease
		 */
		heartbeatLease: (
			jobId: string,
			workerId: string,
			leaseMs: number,
		) => Effect.Effect<void, QueueJobError>;

		/**
		 * Schedule a retry for a failed job
		 */
		scheduleRetry: (
			jobId: string,
			workerId: string,
			delayMs: number,
			errorMessage: string,
		) => Effect.Effect<void, QueueJobError>;

		/**
		 * Reschedule a job without incrementing attempts
		 */
		rescheduleJob: (
			jobId: string,
			workerId: string,
			delayMs: number,
		) => Effect.Effect<void, QueueJobError>;

		/**
		 * Cancel a running job
		 */
		cancelRunningJob: (
			jobId: string,
			workerId: string,
		) => Effect.Effect<void, QueueJobError>;

		/**
		 * Check if cancellation was requested for a job
		 */
		getJobCancelRequestedAt: (
			jobId: string,
		) => Effect.Effect<Date | null, QueueJobError>;

		/**
		 * Recover jobs with expired leases
		 */
		recoverExpiredJobs: () => Effect.Effect<number, QueueJobError>;

		/**
		 * List jobs with optional filters
		 */
		listJobs: (filters: {
			state?: QueueJob["state"];
			type?: string;
			projectId?: string;
			limit?: number;
		}) => Effect.Effect<QueueJob[], QueueJobError>;
	}
>() {}

// ============================================================================
// Docker Service
// ============================================================================

/**
 * Container status information
 */
export interface ContainerStatus {
	name: string;
	service: string;
	state: string;
	health?: string;
}

/**
 * Result of a docker compose command
 */
export interface ComposeResult {
	success: boolean;
	exitCode: number;
	stdout: string;
	stderr: string;
}

/**
 * Service interface for Docker operations
 */
export class DockerService extends Context.Tag("DockerService")<
	DockerService,
	{
		/**
		 * Start containers for a project
		 */
		composeUp: (
			projectId: string,
			projectPath: string,
			preserveProduction?: boolean,
		) => Effect.Effect<ComposeResult, DockerOperationError>;

		/**
		 * Stop containers for a project
		 */
		composeDown: (
			projectId: string,
			projectPath: string,
		) => Effect.Effect<ComposeResult, DockerOperationError>;

		/**
		 * Stop containers and remove volumes
		 */
		composeDownWithVolumes: (
			projectId: string,
			projectPath: string,
		) => Effect.Effect<ComposeResult, DockerOperationError>;

		/**
		 * Get container status for a project
		 */
		composePs: (
			projectId: string,
			projectPath: string,
		) => Effect.Effect<ContainerStatus[], DockerOperationError>;

		/**
		 * Start production container
		 */
		composeUpProduction: (
			projectId: string,
			productionPath: string,
			productionPort: number,
			productionHash?: string,
		) => Effect.Effect<ComposeResult, DockerOperationError>;

		/**
		 * Stop production container
		 */
		composeDownProduction: (
			projectId: string,
			productionPath: string,
			productionHash?: string,
		) => Effect.Effect<ComposeResult, DockerOperationError>;

		/**
		 * Ensure the shared network exists
		 */
		ensureDoceSharedNetwork: () => Effect.Effect<void, DockerOperationError>;

		/**
		 * Ensure a project data volume exists
		 */
		ensureProjectDataVolume: (
			projectId: string,
		) => Effect.Effect<void, DockerOperationError>;

		/**
		 * Ensure an OpenCode storage volume exists
		 */
		ensureOpencodeStorageVolume: (
			projectId: string,
		) => Effect.Effect<void, DockerOperationError>;

		/**
		 * Stream container logs to files
		 */
		streamContainerLogs: (
			projectId: string,
			projectPath: string,
		) => Effect.Effect<void, DockerOperationError>;

		/**
		 * Stop streaming container logs
		 */
		stopStreamingContainerLogs: (
			projectId: string,
		) => Effect.Effect<void, DockerOperationError>;

		/**
		 * Check if containers are healthy
		 */
		waitForHealthy: (
			projectId: string,
			projectPath: string,
			timeoutMs: number,
		) => Effect.Effect<boolean, DockerOperationError>;
	}
>() {}

// ============================================================================
// Database Service (for Queue)
// ============================================================================

/**
 * Service interface for database operations needed by the queue
 */
export class DatabaseService extends Context.Tag("DatabaseService")<
	DatabaseService,
	{
		/**
		 * Get a project by ID
		 */
		getProjectById: (
			projectId: string,
		) => Effect.Effect<Project | null, ProjectOperationError>;

		/**
		 * Update project status
		 */
		updateProjectStatus: (
			projectId: string,
			status: Project["status"],
		) => Effect.Effect<void, ProjectOperationError>;

		/**
		 * Update project production status
		 */
		updateProjectProductionStatus: (
			projectId: string,
			status: Project["productionStatus"],
			error?: string,
		) => Effect.Effect<void, ProjectOperationError>;

		/**
		 * Create a job log entry
		 */
		createJobLog: (
			jobId: string,
			level: "debug" | "info" | "warn" | "error",
			message: string,
		) => Effect.Effect<void, never>;

		/**
		 * Get user settings
		 */
		getUserSettings: (
			userId: string,
		) => Effect.Effect<
			{ openrouterApiKey?: string; defaultModel?: string } | null,
			never
		>;
	}
>() {}

/**
 * Placeholder layer for DatabaseService
 */
export const DatabaseServiceLive = Layer.succeed(
	DatabaseService,
	DatabaseService.of({
		getProjectById: () =>
			Effect.dieMessage("DatabaseServiceLive not implemented"),
		updateProjectStatus: () =>
			Effect.dieMessage("DatabaseServiceLive not implemented"),
		updateProjectProductionStatus: () =>
			Effect.dieMessage("DatabaseServiceLive not implemented"),
		createJobLog: () =>
			Effect.dieMessage("DatabaseServiceLive not implemented"),
		getUserSettings: () =>
			Effect.dieMessage("DatabaseServiceLive not implemented"),
	}),
);
