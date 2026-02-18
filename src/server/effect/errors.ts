/**
 * Typed errors for doce.dev using Effect's Data.TaggedError
 *
 * These errors provide:
 * - Discriminated union pattern matching via _tag
 * - Structured error data for debugging
 * - Type-safe error handling with Effect.catchTag
 */

import { Data } from "effect";

// ============================================================================
// Queue Errors
// ============================================================================

/**
 * Base error type for queue operations
 */
export class QueueError extends Data.TaggedError("QueueError")<{
	readonly message: string;
	readonly jobId?: string;
	readonly jobType?: string;
	readonly projectId?: string;
	readonly cause?: unknown;
}> {}

/**
 * Job not found in database
 */
export class JobNotFoundError extends Data.TaggedError("JobNotFoundError")<{
	readonly jobId: string;
}> {}

/**
 * Job was cancelled by user request
 */
export class JobCancelledError extends Data.TaggedError("JobCancelledError")<{
	readonly jobId: string;
	readonly requestedAt: Date;
}> {}

/**
 * Job exceeded its time limit
 */
export class JobTimeoutError extends Data.TaggedError("JobTimeoutError")<{
	readonly jobId: string;
	readonly timeoutMs: number;
	readonly elapsedMs: number;
}> {}

/**
 * Job should be rescheduled (not an error, control flow)
 */
export class RescheduleError extends Data.TaggedError("RescheduleError")<{
	readonly jobId: string;
	readonly delayMs: number;
	readonly reason: string;
}> {}

/**
 * Job failed after max attempts
 */
export class JobMaxAttemptsError extends Data.TaggedError(
	"JobMaxAttemptsError",
)<{
	readonly jobId: string;
	readonly attempts: number;
	readonly maxAttempts: number;
	readonly lastError: string;
}> {}

/**
 * Failed to claim job from queue
 */
export class JobClaimError extends Data.TaggedError("JobClaimError")<{
	readonly workerId: string;
	readonly reason: string;
}> {}

// ============================================================================
// Docker Errors
// ============================================================================

/**
 * Base error type for Docker operations
 */
export class DockerError extends Data.TaggedError("DockerError")<{
	readonly message: string;
	readonly projectId?: string;
	readonly cause?: unknown;
}> {}

/**
 * Docker compose command failed
 */
export class DockerComposeError extends Data.TaggedError("DockerComposeError")<{
	readonly projectId: string;
	readonly command: string;
	readonly exitCode: number;
	readonly stdout: string;
	readonly stderr: string;
}> {}

/**
 * Container not found
 */
export class ContainerNotFoundError extends Data.TaggedError(
	"ContainerNotFoundError",
)<{
	readonly projectId: string;
	readonly containerName?: string;
}> {}

/**
 * Container health check failed
 */
export class ContainerUnhealthyError extends Data.TaggedError(
	"ContainerUnhealthyError",
)<{
	readonly projectId: string;
	readonly containerName: string;
	readonly healthStatus: string;
	readonly checksAttempted: number;
}> {}

/**
 * Container startup timeout
 */
export class ContainerTimeoutError extends Data.TaggedError(
	"ContainerTimeoutError",
)<{
	readonly projectId: string;
	readonly timeoutMs: number;
	readonly waitedMs: number;
}> {}

/**
 * Docker not available
 */
export class DockerNotAvailableError extends Data.TaggedError(
	"DockerNotAvailableError",
)<{
	readonly reason: string;
}> {}

/**
 * Network creation failed
 */
export class DockerNetworkError extends Data.TaggedError("DockerNetworkError")<{
	readonly networkName: string;
	readonly operation: "create" | "connect";
	readonly cause?: unknown;
}> {}

/**
 * Volume operation failed
 */
export class DockerVolumeError extends Data.TaggedError("DockerVolumeError")<{
	readonly volumeName: string;
	readonly operation: "create" | "remove";
	readonly cause?: unknown;
}> {}

// ============================================================================
// Project Errors
// ============================================================================

/**
 * Project not found
 */
export class ProjectNotFoundError extends Data.TaggedError(
	"ProjectNotFoundError",
)<{
	readonly projectId: string;
}> {}

/**
 * Project already exists
 */
export class ProjectExistsError extends Data.TaggedError("ProjectExistsError")<{
	readonly projectId: string;
	readonly path: string;
}> {}

/**
 * Project operation failed
 */
export class ProjectError extends Data.TaggedError("ProjectError")<{
	readonly projectId?: string;
	readonly operation: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}

// ============================================================================
// Filesystem Errors
// ============================================================================

/**
 * Filesystem operation failed
 */
export class FilesystemError extends Data.TaggedError("FilesystemError")<{
	readonly path: string;
	readonly operation: "read" | "write" | "delete" | "mkdir";
	readonly message: string;
	readonly cause?: unknown;
}> {}

// ============================================================================
// OpenCode Errors
// ============================================================================

/**
 * OpenCode client error
 */
export class OpenCodeError extends Data.TaggedError("OpenCodeError")<{
	readonly projectId: string;
	readonly operation: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}

/**
 * OpenCode session creation failed
 */
export class OpenCodeSessionError extends Data.TaggedError(
	"OpenCodeSessionError",
)<{
	readonly projectId: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}

// ============================================================================
// LLM Errors
// ============================================================================

/**
 * Base error type for LLM operations
 */
export class LlmError extends Data.TaggedError("LlmError")<{
	readonly model: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}

/**
 * LLM request timed out
 */
export class LlmTimeoutError extends Data.TaggedError("LlmTimeoutError")<{
	readonly model: string;
	readonly timeoutMs: number;
}> {}

/**
 * Failed to fetch available models
 */
export class ModelsFetchError extends Data.TaggedError("ModelsFetchError")<{
	readonly source: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}

/**
 * Model not found in the model index
 */
export class ModelNotFoundError extends Data.TaggedError("ModelNotFoundError")<{
	readonly modelId: string;
}> {}

// ============================================================================
// Auth Errors
// ============================================================================

/**
 * Auth file operation failed
 */
export class AuthFileError extends Data.TaggedError("AuthFileError")<{
	readonly operation: "read" | "write" | "delete" | "parse";
	readonly path: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}

/**
 * API key validation failed
 */
export class ApiKeyValidationError extends Data.TaggedError(
	"ApiKeyValidationError",
)<{
	readonly provider: string;
	readonly message: string;
}> {}

// ============================================================================
// Production Errors
// ============================================================================

/**
 * Production build failed
 */
export class ProductionBuildError extends Data.TaggedError(
	"ProductionBuildError",
)<{
	readonly projectId: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}

/**
 * Production deployment failed
 */
export class ProductionDeployError extends Data.TaggedError(
	"ProductionDeployError",
)<{
	readonly projectId: string;
	readonly hash: string;
	readonly message: string;
	readonly cause?: unknown;
}> {}

// ============================================================================
// Error Union Types
// ============================================================================

/**
 * All possible queue job errors
 */
export type QueueJobError =
	| QueueError
	| JobNotFoundError
	| JobCancelledError
	| JobTimeoutError
	| RescheduleError
	| JobMaxAttemptsError
	| JobClaimError;

/**
 * All possible Docker errors
 */
export type DockerOperationError =
	| DockerError
	| DockerComposeError
	| ContainerNotFoundError
	| ContainerUnhealthyError
	| ContainerTimeoutError
	| DockerNotAvailableError
	| DockerNetworkError
	| DockerVolumeError;

/**
 * All possible project errors
 */
export type ProjectOperationError =
	| ProjectNotFoundError
	| ProjectExistsError
	| ProjectError;

/**
 * All possible LLM errors
 */
export type LlmOperationError =
	| LlmError
	| LlmTimeoutError
	| ModelsFetchError
	| ModelNotFoundError;

/**
 * All possible auth errors
 */
export type AuthOperationError = AuthFileError | ApiKeyValidationError;
