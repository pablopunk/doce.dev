import { logger } from "@/server/logger";
import {
	checkOpencodeReady,
	checkPreviewReady,
} from "@/server/projects/health";
import {
	getProjectById,
	type ProjectStatus,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import {
	enqueueDockerEnsureRunning,
	enqueueDockerStop,
} from "@/server/queue/enqueue";
import { listJobs } from "@/server/queue/queue.model";

// Constants from PLAN.md section 9.7.2
const PRESENCE_HEARTBEAT_MS = 15_000;
const REAPER_INTERVAL_MS = 30_000;
const START_MAX_WAIT_MS = 30_000;
const CONTAINER_KEEP_ALIVE_TIMEOUT_MS = 60_000; // 60 seconds - auto-stop containers if no heartbeat received

// Internal only - not exported
interface ProjectPresence {
	projectId: string;
	viewers: Map<string, number>; // viewerId -> lastSeenAt
	lastHeartbeatAt?: number; // When we last received a heartbeat (for keep-alive timeout)
	stopAt?: number; // Scheduled stop time
	startedAt?: number; // When we started the starting process
	isStarting: boolean;
}

export interface PresenceResponse {
	projectId: string;
	status: ProjectStatus;
	viewerCount: number;
	previewUrl: string;
	previewReady: boolean;
	opencodeReady: boolean;
	message: string | null;
	nextPollMs: number;
	// Initial prompt fields (legacy)
	initialPromptSent: boolean;
	initialPromptCompleted: boolean;
	// Prompt tracking (session.init no longer per-project)
	userPromptCompleted: boolean;
	userPromptMessageId: string | null;
	prompt: string;
	// Project slug
	slug: string;
	// Session ID for chat
	bootstrapSessionId: string | null;
	// Setup error (if a queue job failed during setup)
	setupError: string | null;
	// OpenCode diagnostic (if there's an active error)
	opencodeDiagnostic: {
		category: string | null;
		message: string | null;
		remediation: string[] | null;
	} | null;
}

// In-memory presence state
const presenceMap = new Map<string, ProjectPresence>();

// Per-project mutex using queue-based locking to prevent race conditions
interface LockRequest {
	resolve: () => void;
}
const projectLockQueues = new Map<string, LockRequest[]>();
const projectLockHolders = new Map<string, number>(); // version counter per project

/**
 * Acquire a lock for a project. Returns a release function.
 * Uses a queue-based approach to ensure strictly sequential access.
 */
async function acquireLock(projectId: string): Promise<() => void> {
	let resolveLock: (() => void) | undefined;
	const lockPromise = new Promise<void>((resolve) => {
		resolveLock = resolve;
	});

	const queue = projectLockQueues.get(projectId) ?? [];
	projectLockQueues.set(projectId, queue);

	// Add ourselves to the queue
	if (!resolveLock) {
		throw new Error("Failed to initialize lock resolver");
	}
	queue.push({ resolve: resolveLock as () => void });

	// If we're first in queue, acquire immediately
	if (queue.length === 1) {
		resolveLock?.();
	} else {
		// Otherwise, wait for our turn
		await lockPromise;
	}

	// Track that we hold the lock
	const lockVersion = (projectLockHolders.get(projectId) ?? 0) + 1;
	projectLockHolders.set(projectId, lockVersion);

	// Return release function
	return () => {
		// Remove ourselves from queue
		queue.shift();

		// Wake up next waiter if any
		if (queue.length > 0) {
			queue[0]?.resolve();
		} else {
			// Clean up empty queue
			projectLockQueues.delete(projectId);
		}
	};
}

/**
 * Get or create presence record for a project.
 */
function getPresence(projectId: string): ProjectPresence {
	let presence = presenceMap.get(projectId);
	if (!presence) {
		presence = {
			projectId,
			viewers: new Map(),
			isStarting: false,
		};
		presenceMap.set(projectId, presence);
	}
	return presence;
}

/**
 * Calculate next poll interval based on how long we've been starting.
 */
function calculateNextPollMs(startedAt: number): number {
	const elapsed = Date.now() - startedAt;
	const pollCount = Math.floor(elapsed / 500);

	if (pollCount < 3) return 500;
	if (pollCount < 13) return 1000;
	return 2000;
}

/**
 * Check for any failed queue jobs related to this project's setup
 */
async function getSetupError(projectId: string): Promise<string | null> {
	try {
		const failedJobs = await listJobs({
			projectId,
			state: "failed",
			limit: 1,
		});

		if (failedJobs.length > 0) {
			const failedJob = failedJobs[0];
			if (!failedJob) {
				return "Setup job failed without error details";
			}
			return failedJob.lastError || "Setup job failed without error details";
		}

		return null;
	} catch (_error) {
		return null;
	}
}

/**
 * Handle a presence heartbeat from a viewer.
 * This is the main entry point for the presence system.
 */
export async function handlePresenceHeartbeat(
	projectId: string,
	viewerId: string,
): Promise<PresenceResponse> {
	const release = await acquireLock(projectId);

	try {
		const project = await getProjectById(projectId);
		if (!project) {
			throw new Error("Project not found");
		}

		const presence = getPresence(projectId);

		// Check for setup errors from failed queue jobs
		const setupError = await getSetupError(projectId);

		if (project.status === "deleting") {
			return {
				projectId,
				status: "deleting",
				viewerCount: 0,
				previewUrl: `http://127.0.0.1:${project.devPort}`,
				previewReady: false,
				opencodeReady: false,
				message: "Project is being deleted...",
				nextPollMs: 2000,
				initialPromptSent: project.initialPromptSent,
				initialPromptCompleted: project.initialPromptCompleted,
				userPromptCompleted: project.userPromptCompleted,
				userPromptMessageId: project.userPromptMessageId,
				prompt: project.prompt,
				slug: project.slug,
				bootstrapSessionId: project.bootstrapSessionId,
				setupError,
				opencodeDiagnostic: project.opencodeErrorCategory
					? {
							category: project.opencodeErrorCategory,
							message: project.opencodeErrorMessage,
							remediation: null,
						}
					: null,
			};
		}

		// Update viewer presence
		presence.viewers.set(viewerId, Date.now());

		// Cancel any scheduled stop
		delete presence.stopAt;

		// Update last heartbeat time to reset the keep-alive timer
		presence.lastHeartbeatAt = Date.now();

		// Check current health and periodically capture container logs
		const [previewReady, opencodeReady] = await Promise.all([
			checkPreviewReady(project.id),
			checkOpencodeReady(project.id),
		]);

		// Reconcile status based on health checks
		let status = project.status;
		let message: string | null = null;
		let nextPollMs = PRESENCE_HEARTBEAT_MS;

		if (previewReady && opencodeReady) {
			// Both services are up
			if (status !== "running") {
				await updateProjectStatus(projectId, "running");
				status = "running";
			}
			presence.isStarting = false;
			message = null;
		} else if (presence.isStarting) {
			// We're in the process of starting
			status = "starting";

			if (!presence.startedAt) {
				presence.startedAt = Date.now();
			}

			const elapsed = Date.now() - presence.startedAt;

			if (elapsed > START_MAX_WAIT_MS) {
				// Timeout - mark as error
				await updateProjectStatus(projectId, "error");
				status = "error";
				presence.isStarting = false;
				message = "Failed to start containers. Open terminal for details.";
				nextPollMs = 2000;
			} else {
				// Still starting
				if (!previewReady && !opencodeReady) {
					message = "Starting containers...";
				} else if (!previewReady) {
					message = "Waiting for preview...";
				} else {
					message = "Waiting for opencode...";
				}
				nextPollMs = calculateNextPollMs(presence.startedAt);
			}
		} else if (
			status === "created" ||
			status === "stopped" ||
			status === "error"
		) {
			// Need to start the containers
			presence.isStarting = true;
			presence.startedAt = Date.now();

			try {
				await enqueueDockerEnsureRunning({ projectId, reason: "presence" });
				status = "starting";
				message = "Starting containers...";
				nextPollMs = 500;
			} catch (error) {
				await updateProjectStatus(projectId, "error");
				status = "error";
				message = "Failed to start containers. Open terminal for details.";
				nextPollMs = 2000;
				logger.error({ error, projectId }, "Failed to enqueue container start");
			}
		} else if (status === "running" && !previewReady && !opencodeReady) {
			// Containers crashed or were stopped externally
			await updateProjectStatus(projectId, "stopped");
			status = "stopped";

			// Trigger restart
			presence.isStarting = true;
			presence.startedAt = Date.now();

			try {
				await enqueueDockerEnsureRunning({ projectId, reason: "presence" });
				status = "starting";
				message = "Restarting containers...";
				nextPollMs = 500;
			} catch (error) {
				await updateProjectStatus(projectId, "error");
				status = "error";
				message = "Failed to restart containers. Open terminal for details.";
				nextPollMs = 2000;
				logger.error(
					{ error, projectId },
					"Failed to enqueue container restart",
				);
			}
		}

		return {
			projectId,
			status,
			viewerCount: presence.viewers.size,
			previewUrl: `http://127.0.0.1:${project.devPort}`,
			previewReady,
			opencodeReady,
			message,
			nextPollMs,
			initialPromptSent: project.initialPromptSent,
			initialPromptCompleted: project.initialPromptCompleted,
			userPromptCompleted: project.userPromptCompleted,
			userPromptMessageId: project.userPromptMessageId,
			prompt: project.prompt,
			slug: project.slug,
			bootstrapSessionId: project.bootstrapSessionId,
			setupError,
			opencodeDiagnostic: project.opencodeErrorCategory
				? {
						category: project.opencodeErrorCategory,
						message: project.opencodeErrorMessage,
						remediation: null,
					}
				: null,
		};
	} finally {
		release();
	}
}

/**
 * Reaper function that runs periodically to clean up idle projects.
 */
async function runReaper(): Promise<void> {
	const now = Date.now();

	for (const [projectId, presence] of presenceMap) {
		// Skip if operations in progress
		if (presence.isStarting) {
			continue;
		}

		// Prune stale viewers (haven't heartbeated in 2x interval)
		const staleThreshold = now - 2 * PRESENCE_HEARTBEAT_MS;
		for (const [viewerId, lastSeen] of presence.viewers) {
			if (lastSeen < staleThreshold) {
				presence.viewers.delete(viewerId);
				logger.debug({ projectId, viewerId }, "Pruned stale viewer");
			}
		}

		// Handle keep-alive timeout for running containers
		const project = await getProjectById(projectId);
		if (project?.status === "running") {
			if (presence.lastHeartbeatAt !== undefined) {
				const timeSinceLastHeartbeat = now - presence.lastHeartbeatAt;

				// Stop if no heartbeat received for keep-alive timeout AND no active viewers
				if (
					timeSinceLastHeartbeat >= CONTAINER_KEEP_ALIVE_TIMEOUT_MS &&
					presence.viewers.size === 0
				) {
					try {
						await enqueueDockerStop({ projectId, reason: "idle" });
						delete presence.lastHeartbeatAt;
						logger.info(
							{ projectId, timeSinceLastHeartbeat },
							"Container stopped due to keep-alive timeout",
						);
					} catch (error) {
						logger.error(
							{ error, projectId },
							"Failed to enqueue container stop",
						);
					}
				}
			}
		}

		// Note: Container auto-stops if no heartbeat received for 60 seconds
		// Heartbeats come from active viewers in PreviewPanel, ChatPanel, etc.
	}
}

// Start the reaper
let reaperInterval: ReturnType<typeof setInterval> | null = null;

export function startReaper(): void {
	if (reaperInterval) return;

	// Execute reaper immediately on start
	runReaper().catch((err) => {
		logger.error({ error: err }, "Initial reaper execution failed");
	});

	// Then set interval - wrap in error handler since runReaper is async
	reaperInterval = setInterval(() => {
		runReaper().catch((err) => {
			logger.error({ error: err }, "Reaper execution failed");
		});
	}, REAPER_INTERVAL_MS);

	logger.info("Presence reaper started");
}

export function stopReaper(): void {
	if (reaperInterval) {
		clearInterval(reaperInterval);
		reaperInterval = null;
		logger.info("Presence reaper stopped");
	}
}

// Auto-start reaper on module load
startReaper();
