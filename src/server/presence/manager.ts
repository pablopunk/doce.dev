import { randomBytes } from "node:crypto";
import { eq, and, gt } from "drizzle-orm";
import { logger } from "@/server/logger";
import { db } from "@/server/db/client";
import {
	presence,
	presenceViewers,
	type NewPresence,
	type NewPresenceViewer,
} from "@/server/db/schema";
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
const CONTAINER_KEEP_ALIVE_TIMEOUT_MS = 60_000;

export interface PresenceResponse {
	projectId: string;
	status: ProjectStatus;
	viewerCount: number;
	previewUrl: string;
	previewReady: boolean;
	opencodeReady: boolean;
	message: string | null;
	nextPollMs: number;
	initialPromptSent: boolean;
	initialPromptCompleted: boolean;
	userPromptCompleted: boolean;
	userPromptMessageId: string | null;
	prompt: string;
	model: string | null;
	slug: string;
	bootstrapSessionId: string | null;
	setupError: string | null;
}

async function getPresenceRecord(projectId: string) {
	const record = await db
		.select()
		.from(presence)
		.where(eq(presence.projectId, projectId))
		.get();
	if (!record) {
		const newRecord: NewPresence = {
			projectId,
			isStarting: false,
			updatedAt: new Date(),
		};
		await db.insert(presence).values(newRecord);
		return {
			...newRecord,
			lastHeartbeatAt: null,
			stopAt: null,
			startedAt: null,
		};
	}
	return record;
}

async function updatePresenceRecord(
	projectId: string,
	updates: {
		lastHeartbeatAt?: Date | null;
		stopAt?: Date | null;
		startedAt?: Date | null;
		isStarting?: boolean;
	},
) {
	await db
		.update(presence)
		.set({
			...updates,
			updatedAt: new Date(),
		})
		.where(eq(presence.projectId, projectId));
}

async function getViewerCount(projectId: string) {
	const viewers = await db
		.select()
		.from(presenceViewers)
		.where(eq(presenceViewers.projectId, projectId));
	return viewers.length;
}

async function upsertViewer(projectId: string, viewerId: string) {
	const existing = await db
		.select()
		.from(presenceViewers)
		.where(
			and(
				eq(presenceViewers.projectId, projectId),
				eq(presenceViewers.viewerId, viewerId),
			),
		)
		.get();

	if (existing) {
		await db
			.update(presenceViewers)
			.set({ lastSeenAt: new Date() })
			.where(eq(presenceViewers.id, existing.id));
	} else {
		const newViewer: NewPresenceViewer = {
			id: randomBytes(16).toString("hex"),
			projectId,
			viewerId,
			lastSeenAt: new Date(),
			createdAt: new Date(),
		};
		await db.insert(presenceViewers).values(newViewer);
	}
}

async function pruneStaleViewers(projectId: string) {
	const staleThreshold = new Date(Date.now() - 2 * PRESENCE_HEARTBEAT_MS);
	const staleViewers = await db
		.select()
		.from(presenceViewers)
		.where(
			and(
				eq(presenceViewers.projectId, projectId),
				gt(presenceViewers.lastSeenAt, staleThreshold),
			),
		);

	for (const viewer of staleViewers) {
		if (viewer.lastSeenAt < staleThreshold) {
			await db.delete(presenceViewers).where(eq(presenceViewers.id, viewer.id));
			logger.debug(
				{ projectId, viewerId: viewer.viewerId },
				"Pruned stale viewer",
			);
		}
	}
}

async function acquireLock(projectId: string): Promise<() => void> {
	const lockKey = `presence_lock:${projectId}`;
	const lockValue = randomBytes(16).toString("hex");
	const startTime = Date.now();

	while (Date.now() - startTime < 10000) {
		try {
			await db.insert(presenceViewers).values({
				id: lockKey,
				projectId,
				viewerId: `__lock_${lockValue}`,
				lastSeenAt: new Date(),
				createdAt: new Date(),
			});
			return async () => {
				await db.delete(presenceViewers).where(eq(presenceViewers.id, lockKey));
			};
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	throw new Error(`Failed to acquire lock for project ${projectId}`);
}

function calculateNextPollMs(startedAt: Date): number {
	const elapsed = Date.now() - startedAt.getTime();
	const pollCount = Math.floor(elapsed / 500);

	if (pollCount < 3) return 500;
	if (pollCount < 13) return 1000;
	return 2000;
}

async function getSetupError(projectId: string): Promise<string | null> {
	try {
		const failedJobs = await listJobs({
			projectId,
			state: "failed",
			limit: 1,
		});

		if (failedJobs.length > 0) {
			const failedJob = failedJobs[0]!;
			return failedJob.lastError || "Setup job failed without error details";
		}

		return null;
	} catch (error) {
		return null;
	}
}

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

		const presenceRecord = await getPresenceRecord(projectId);

		const setupError = await getSetupError(projectId);

		if (project.status === "deleting") {
			return {
				projectId,
				status: "deleting",
				viewerCount: await getViewerCount(projectId),
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
				model: project.currentModel,
				slug: project.slug,
				bootstrapSessionId: project.bootstrapSessionId,
				setupError,
			};
		}

		await upsertViewer(projectId, viewerId);

		await updatePresenceRecord(projectId, {
			stopAt: null,
			lastHeartbeatAt: new Date(),
		});

		const [previewReady, opencodeReady] = await Promise.all([
			checkPreviewReady(project.devPort),
			checkOpencodeReady(project.opencodePort),
		]);

		let status = project.status;
		let message: string | null = null;
		let nextPollMs = PRESENCE_HEARTBEAT_MS;

		if (previewReady && opencodeReady) {
			if (status !== "running") {
				await updateProjectStatus(projectId, "running");
				status = "running";
			}
			await updatePresenceRecord(projectId, { isStarting: false });
			message = null;
		} else if (presenceRecord.isStarting) {
			status = "starting";

			if (!presenceRecord.startedAt) {
				await updatePresenceRecord(projectId, { startedAt: new Date() });
			}

			const startedAt = presenceRecord.startedAt || new Date();
			const elapsed = Date.now() - startedAt.getTime();

			if (elapsed > START_MAX_WAIT_MS) {
				await updateProjectStatus(projectId, "error");
				status = "error";
				await updatePresenceRecord(projectId, { isStarting: false });
				message = "Failed to start containers. Open terminal for details.";
				nextPollMs = 2000;
			} else {
				if (!previewReady && !opencodeReady) {
					message = "Starting containers...";
				} else if (!previewReady) {
					message = "Waiting for preview...";
				} else {
					message = "Waiting for opencode...";
				}
				nextPollMs = calculateNextPollMs(startedAt);
			}
		} else if (
			status === "created" ||
			status === "stopped" ||
			status === "error"
		) {
			await updatePresenceRecord(projectId, {
				isStarting: true,
				startedAt: new Date(),
			});

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
			await updateProjectStatus(projectId, "stopped");
			status = "stopped";

			await updatePresenceRecord(projectId, {
				isStarting: true,
				startedAt: new Date(),
			});

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
			viewerCount: await getViewerCount(projectId),
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
			model: project.currentModel,
			slug: project.slug,
			bootstrapSessionId: project.bootstrapSessionId,
			setupError,
		};
	} finally {
		await release();
	}
}

async function runReaper(): Promise<void> {
	const presenceRecords = await db.select().from(presence);

	for (const record of presenceRecords) {
		const { projectId, isStarting, lastHeartbeatAt } = record;

		if (isStarting) {
			continue;
		}

		await pruneStaleViewers(projectId);

		const project = await getProjectById(projectId);
		if (project?.status === "running") {
			if (lastHeartbeatAt) {
				const timeSinceLastHeartbeat = Date.now() - lastHeartbeatAt.getTime();
				const viewerCount = await getViewerCount(projectId);

				if (
					timeSinceLastHeartbeat >= CONTAINER_KEEP_ALIVE_TIMEOUT_MS &&
					viewerCount === 0
				) {
					try {
						await enqueueDockerStop({ projectId, reason: "idle" });
						await updatePresenceRecord(projectId, { lastHeartbeatAt: null });
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
	}
}

let reaperInterval: ReturnType<typeof setInterval> | null = null;

export function startReaper(): void {
	if (reaperInterval) return;

	runReaper().catch((err) => {
		logger.error({ error: err }, "Initial reaper execution failed");
	});

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

startReaper();
