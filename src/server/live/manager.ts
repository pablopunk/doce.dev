/**
 * ProjectStateManager — server-side live state engine.
 *
 * Event-driven version:
 * - broadcasts full snapshots to SSE clients
 * - refreshes on project mutations and queue mutations for the same project
 * - keeps an SSE heartbeat alive for proxies/load balancers
 * - manages viewer lifecycle and idle auto-stop
 */

import { logger } from "@/server/logger";
import {
	getActiveProductionJob,
	getProductionStatus,
} from "@/server/productions/productions.model";
import { subscribeProjectEvents } from "@/server/projects/events";
import {
	checkOpencodeReady,
	checkPreviewReady,
} from "@/server/projects/health";
import {
	getProjectById,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { getProjectRuntimeUrls } from "@/server/projects/projectUrls";
import {
	enqueueDockerEnsureRunning,
	enqueueDockerStop,
} from "@/server/queue/enqueue";
import { subscribeQueueEvents } from "@/server/queue/events";
import { listJobs } from "@/server/queue/queue.crud";
import type { ProductionLiveState, ProjectLiveState } from "@/types/live";

const HEARTBEAT_INTERVAL_MS = 15_000;
const IDLE_STOP_DELAY_MS = 5 * 60 * 1_000;
const START_TIMEOUT_MS = 120_000;

type SendFn = (state: ProjectLiveState) => void;

interface Client {
	id: string;
	send: SendFn;
}

interface ManagerState {
	current: ProjectLiveState;
	clients: Map<string, Client>;
	gen: number;
	heartbeatTimer: ReturnType<typeof setInterval> | null;
	idleStopTimer: ReturnType<typeof setTimeout> | null;
	startedAt: number | null;
	refreshInFlight: Promise<void> | null;
	unsubscribeProjectEvents: (() => void) | null;
	unsubscribeQueueEvents: (() => void) | null;
}

const managers = new Map<string, ManagerState>();

export function registerClient(
	projectId: string,
	clientId: string,
	send: SendFn,
): () => void {
	const state = getOrCreateManager(projectId);
	if (state.idleStopTimer) {
		clearTimeout(state.idleStopTimer);
		state.idleStopTimer = null;
	}

	state.clients.set(clientId, { id: clientId, send });
	logger.debug({ projectId, clientId }, "Live client connected");
	send(state.current);

	if (state.clients.size === 1) {
		void ensureRunning(projectId, state);
	}
	void refresh(projectId, state);

	return () => {
		deregisterClient(projectId, clientId);
	};
}

function getOrCreateManager(projectId: string): ManagerState {
	const existing = managers.get(projectId);
	if (existing) return existing;

	const state: ManagerState = {
		current: makeInitialState(),
		clients: new Map(),
		gen: 0,
		heartbeatTimer: null,
		idleStopTimer: null,
		startedAt: null,
		refreshInFlight: null,
		unsubscribeProjectEvents: null,
		unsubscribeQueueEvents: null,
	};
	managers.set(projectId, state);

	state.unsubscribeProjectEvents = subscribeProjectEvents(projectId, () => {
		void refresh(projectId, state);
	});
	state.unsubscribeQueueEvents = subscribeQueueEvents((event) => {
		if (event.projectId !== projectId) return;
		void refresh(projectId, state);
	});

	state.heartbeatTimer = setInterval(() => {
		broadcast(state);
	}, HEARTBEAT_INTERVAL_MS);

	void refresh(projectId, state);
	return state;
}

function makeInitialState(): ProjectLiveState {
	return {
		gen: 0,
		status: "created",
		previewReady: false,
		opencodeReady: false,
		previewUrl: "",
		previewUrls: { local: null, tailscale: null, preferred: "" },
		message: null,
		viewerCount: 0,
		slug: "",
		prompt: "",
		bootstrapSessionId: null,
		setupError: null,
		opencodeDiagnostic: null,
		initialPromptSent: false,
		initialPromptCompleted: false,
		userPromptCompleted: false,
		userPromptMessageId: null,
		production: {
			status: "stopped",
			url: null,
			urls: { local: null, tailscale: null, preferred: null },
			port: 0,
			error: null,
			startedAt: null,
			activeJobType: null,
		},
	};
}

function deregisterClient(projectId: string, clientId: string): void {
	const state = managers.get(projectId);
	if (!state) return;
	state.clients.delete(clientId);
	logger.debug(
		{ projectId, clientId, remaining: state.clients.size },
		"Live client disconnected",
	);
	if (state.clients.size === 0) {
		scheduleIdleStop(projectId, state);
	}
}

function scheduleIdleStop(projectId: string, state: ManagerState): void {
	if (state.idleStopTimer) return;
	state.idleStopTimer = setTimeout(async () => {
		if (state.clients.size > 0) return;
		try {
			await enqueueDockerStop({ projectId, reason: "idle" });
			logger.info({ projectId }, "Idle stop enqueued after last viewer left");
		} catch (error) {
			logger.error({ error, projectId }, "Failed to enqueue idle stop");
		}
		stopManager(projectId, state);
	}, IDLE_STOP_DELAY_MS);
}

function stopManager(projectId: string, state: ManagerState): void {
	if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
	if (state.idleStopTimer) clearTimeout(state.idleStopTimer);
	state.unsubscribeProjectEvents?.();
	state.unsubscribeQueueEvents?.();
	managers.delete(projectId);
	logger.debug({ projectId }, "Live manager torn down");
}

function broadcast(state: ManagerState): void {
	state.gen += 1;
	const snapshot = {
		...state.current,
		gen: state.gen,
		viewerCount: state.clients.size,
	};
	for (const client of state.clients.values()) {
		try {
			client.send(snapshot);
		} catch (error) {
			logger.warn({ error, clientId: client.id }, "Failed to send to client");
		}
	}
}

async function ensureRunning(
	projectId: string,
	state: ManagerState,
): Promise<void> {
	const project = await getProjectById(projectId);
	if (!project) return;
	const needsStart =
		project.status === "created" ||
		project.status === "stopped" ||
		project.status === "error";
	if (!needsStart) return;

	state.startedAt = Date.now();
	try {
		await enqueueDockerEnsureRunning({ projectId, reason: "presence" });
	} catch (error) {
		logger.error({ error, projectId }, "Failed to enqueue ensure-running");
	}
}

async function refresh(projectId: string, state: ManagerState): Promise<void> {
	if (state.refreshInFlight) {
		await state.refreshInFlight;
		return;
	}

	state.refreshInFlight = (async () => {
		try {
			const next = await buildState(projectId, state);
			if (hasChanged(state.current, next)) {
				state.current = next;
				broadcast(state);
			}
		} catch (error) {
			logger.error({ error, projectId }, "Live state refresh failed");
		} finally {
			state.refreshInFlight = null;
		}
	})();

	await state.refreshInFlight;
}

async function buildState(
	projectId: string,
	state: ManagerState,
): Promise<ProjectLiveState> {
	const project = await getProjectById(projectId);
	if (!project) {
		return { ...state.current, status: "error", message: "Project not found" };
	}

	const [previewReady, opencodeReady, setupError, activeProductionJob] =
		await Promise.all([
			checkPreviewReady(project.id),
			checkOpencodeReady(),
			getSetupError(projectId),
			getActiveProductionJob(projectId),
		]);

	const runtimeUrls = await getProjectRuntimeUrls(project);
	const production = getProductionStatus(project);
	const productionState: ProductionLiveState = {
		status: production.status,
		url:
			production.status === "running" ? runtimeUrls.production.preferred : null,
		urls:
			production.status === "running"
				? runtimeUrls.production
				: { local: null, tailscale: null, preferred: null },
		port: production.port ?? project.productionPort,
		error: production.error,
		startedAt: production.startedAt?.toISOString() ?? null,
		activeJobType: activeProductionJob?.type ?? null,
	};

	let status = project.status;
	let message: string | null = null;

	if (previewReady && opencodeReady) {
		if (status !== "running") {
			await updateProjectStatus(projectId, "running");
			status = "running";
		}
		state.startedAt = null;
	} else if (status === "running") {
		await updateProjectStatus(projectId, "stopped");
		status = "stopped";
		state.startedAt = Date.now();
		void enqueueDockerEnsureRunning({ projectId, reason: "presence" }).catch(
			(error) => logger.error({ error, projectId }, "Recovery enqueue failed"),
		);
		message = `Restarting ${[!previewReady ? "preview" : null, !opencodeReady ? "opencode" : null].filter(Boolean).join(" and ")}...`;
	} else if (
		status === "starting" ||
		status === "created" ||
		status === "stopped"
	) {
		status = "starting";
		if (!state.startedAt) state.startedAt = Date.now();
		const elapsed = Date.now() - state.startedAt;
		if (elapsed > START_TIMEOUT_MS) {
			await updateProjectStatus(projectId, "error");
			status = "error";
			state.startedAt = null;
			message = "Containers failed to start. Open terminal for details.";
		} else if (!previewReady && !opencodeReady) {
			message = "Starting containers...";
		} else if (!previewReady) {
			message = "Waiting for preview server...";
		} else {
			message = "Waiting for opencode...";
		}
	}

	return {
		gen: state.gen,
		status,
		previewReady,
		opencodeReady,
		previewUrl: runtimeUrls.preview.preferred,
		previewUrls: runtimeUrls.preview,
		message,
		viewerCount: state.clients.size,
		slug: project.slug,
		prompt: project.prompt,
		bootstrapSessionId: project.bootstrapSessionId,
		setupError,
		opencodeDiagnostic: project.opencodeErrorCategory
			? {
					category: project.opencodeErrorCategory,
					message: project.opencodeErrorMessage,
				}
			: null,
		initialPromptSent: project.initialPromptSent,
		initialPromptCompleted: project.initialPromptCompleted,
		userPromptCompleted: project.userPromptCompleted,
		userPromptMessageId: project.userPromptMessageId,
		production: productionState,
	};
}

async function getSetupError(projectId: string): Promise<string | null> {
	try {
		const failed = await listJobs({ projectId, state: "failed", limit: 1 });
		return failed[0]?.lastError ?? null;
	} catch {
		return null;
	}
}

function hasChanged(prev: ProjectLiveState, next: ProjectLiveState): boolean {
	return (
		prev.status !== next.status ||
		prev.previewReady !== next.previewReady ||
		prev.opencodeReady !== next.opencodeReady ||
		prev.previewUrl !== next.previewUrl ||
		prev.previewUrls.local !== next.previewUrls.local ||
		prev.previewUrls.tailscale !== next.previewUrls.tailscale ||
		prev.message !== next.message ||
		prev.setupError !== next.setupError ||
		prev.initialPromptCompleted !== next.initialPromptCompleted ||
		prev.userPromptCompleted !== next.userPromptCompleted ||
		prev.userPromptMessageId !== next.userPromptMessageId ||
		prev.bootstrapSessionId !== next.bootstrapSessionId ||
		prev.prompt !== next.prompt ||
		prev.slug !== next.slug ||
		prev.opencodeDiagnostic?.category !== next.opencodeDiagnostic?.category ||
		prev.production.status !== next.production.status ||
		prev.production.url !== next.production.url ||
		prev.production.error !== next.production.error ||
		prev.production.activeJobType !== next.production.activeJobType
	);
}
