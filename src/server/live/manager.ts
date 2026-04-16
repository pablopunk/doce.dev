/**
 * ProjectStateManager — server-side live state engine.
 *
 * One instance per active project. Manages:
 * - A single shared health-poll interval (not per-client)
 * - Broadcasting full state snapshots to all SSE clients on change
 * - Viewer lifecycle via SSE connection open/close (no heartbeat API needed)
 * - Container auto-stop when last viewer disconnects (after idle timeout)
 * - Container auto-start when first viewer connects
 */

import { logger } from "@/server/logger";
import {
	getActiveProductionJob,
	getProductionStatus,
} from "@/server/productions/productions.model";
import {
	checkOpencodeReady,
	checkPreviewReady,
} from "@/server/projects/health";
import {
	getProjectById,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import {
	enqueueDockerEnsureRunning,
	enqueueDockerStop,
} from "@/server/queue/enqueue";
import { listJobs } from "@/server/queue/queue.crud";
import { getTailscaleProjectUrl } from "@/server/tailscale/urls";
import type { ProductionLiveState, ProjectLiveState } from "@/types/live";

const POLL_INTERVAL_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
const IDLE_STOP_DELAY_MS = 5 * 60 * 1_000; // 5 minutes

// How long to tolerate a container starting before giving up
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
	pollTimer: ReturnType<typeof setInterval> | null;
	heartbeatTimer: ReturnType<typeof setInterval> | null;
	idleStopTimer: ReturnType<typeof setTimeout> | null;
	startedAt: number | null; // when we began waiting for containers
}

const managers = new Map<string, ManagerState>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Register an SSE client for a project. Returns a cleanup function.
 * Called when a client opens the /live endpoint.
 */
export function registerClient(
	projectId: string,
	clientId: string,
	send: SendFn,
): () => void {
	const state = getOrCreateManager(projectId);

	// Cancel any pending idle stop
	if (state.idleStopTimer) {
		clearTimeout(state.idleStopTimer);
		state.idleStopTimer = null;
	}

	state.clients.set(clientId, { id: clientId, send });
	logger.debug({ projectId, clientId }, "Live client connected");

	// Send current state immediately
	send(state.current);

	// Ensure containers are running when first viewer connects
	if (state.clients.size === 1) {
		void ensureRunning(projectId, state);
	}

	return () => {
		deregisterClient(projectId, clientId);
	};
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function getOrCreateManager(projectId: string): ManagerState {
	let state = managers.get(projectId);
	if (state) return state;

	const initial = makeInitialState();
	state = {
		current: initial,
		clients: new Map(),
		gen: 0,
		pollTimer: null,
		heartbeatTimer: null,
		idleStopTimer: null,
		startedAt: null,
	};
	managers.set(projectId, state);

	startPolling(projectId, state);

	return state;
}

function makeInitialState(): ProjectLiveState {
	return {
		gen: 0,
		status: "created",
		previewReady: false,
		opencodeReady: false,
		previewUrl: "",
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
		// Double-check still no clients
		if (state.clients.size > 0) return;

		try {
			await enqueueDockerStop({ projectId, reason: "idle" });
			logger.info({ projectId }, "Idle stop enqueued after last viewer left");
		} catch (err) {
			logger.error({ err, projectId }, "Failed to enqueue idle stop");
		}

		// Tear down manager — next viewer will recreate it
		stopManager(projectId, state);
	}, IDLE_STOP_DELAY_MS);
}

function stopManager(projectId: string, state: ManagerState): void {
	if (state.pollTimer) clearInterval(state.pollTimer);
	if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
	if (state.idleStopTimer) clearTimeout(state.idleStopTimer);
	managers.delete(projectId);
	logger.debug({ projectId }, "Live manager torn down");
}

function startPolling(projectId: string, state: ManagerState): void {
	// Immediate first poll
	void poll(projectId, state);

	state.pollTimer = setInterval(() => {
		void poll(projectId, state);
	}, POLL_INTERVAL_MS);

	// Heartbeat keeps SSE connections alive through proxies/load balancers
	state.heartbeatTimer = setInterval(() => {
		sendHeartbeat(state);
	}, HEARTBEAT_INTERVAL_MS);
}

function sendHeartbeat(state: ManagerState): void {
	// Heartbeats are sent as SSE comments — they reset the client's
	// heartbeat liveness timer without triggering onmessage handlers.
	// We implement this by sending the current state (which resets the timer).
	// Alternatively, we could expose a separate heartbeat channel, but
	// broadcasting a fresh snapshot doubles as a consistency check.
	broadcast(state);
}

async function poll(projectId: string, state: ManagerState): Promise<void> {
	try {
		const next = await buildState(projectId, state);
		if (hasChanged(state.current, next)) {
			state.current = next;
			broadcast(state);
		}
	} catch (err) {
		logger.error({ err, projectId }, "Live state poll failed");
	}
}

function broadcast(state: ManagerState): void {
	state.gen += 1;
	const snapshot = { ...state.current, gen: state.gen };
	for (const client of state.clients.values()) {
		try {
			client.send(snapshot);
		} catch (err) {
			logger.warn({ err, clientId: client.id }, "Failed to send to client");
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

	if (needsStart) {
		state.startedAt = Date.now();
		try {
			await enqueueDockerEnsureRunning({ projectId, reason: "presence" });
		} catch (err) {
			logger.error({ err, projectId }, "Failed to enqueue ensure-running");
		}
	}
}

async function buildState(
	projectId: string,
	state: ManagerState,
): Promise<ProjectLiveState> {
	const project = await getProjectById(projectId);
	if (!project) {
		return {
			...state.current,
			status: "error",
			message: "Project not found",
		};
	}

	const [previewReady, opencodeReady, setupError, activeProductionJob] =
		await Promise.all([
			checkPreviewReady(project.id),
			checkOpencodeReady(),
			getSetupError(projectId),
			getActiveProductionJob(projectId),
		]);

	const production = getProductionStatus(project);

	const productionState: ProductionLiveState = {
		status: production.status,
		url: production.url,
		port: production.port ?? project.productionPort,
		error: production.error,
		startedAt: production.startedAt?.toISOString() ?? null,
		activeJobType: activeProductionJob?.type ?? null,
	};

	// Reconcile container status
	let status = project.status;
	let message: string | null = null;

	if (previewReady && opencodeReady) {
		if (status !== "running") {
			await updateProjectStatus(projectId, "running");
			status = "running";
		}
		state.startedAt = null;
	} else if (status === "running") {
		// Containers were running but one crashed — trigger recovery
		await updateProjectStatus(projectId, "stopped");
		status = "stopped";
		state.startedAt = Date.now();

		enqueueDockerEnsureRunning({ projectId, reason: "presence" }).catch((err) =>
			logger.error({ err, projectId }, "Recovery enqueue failed"),
		);

		const missing = [
			!previewReady ? "preview" : null,
			!opencodeReady ? "opencode" : null,
		]
			.filter(Boolean)
			.join(" and ");
		message = `Restarting ${missing}...`;
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
		gen: state.gen, // will be overwritten by broadcast()
		status,
		previewReady,
		opencodeReady,
		previewUrl:
			(await getTailscaleProjectUrl(project.slug, "preview")) ??
			`http://127.0.0.1:${project.devPort}`,
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

/**
 * Deep-compare only the fields that matter for triggering a broadcast.
 * We skip `gen` and `viewerCount` since those change on every poll.
 */
function hasChanged(prev: ProjectLiveState, next: ProjectLiveState): boolean {
	return (
		prev.status !== next.status ||
		prev.previewReady !== next.previewReady ||
		prev.opencodeReady !== next.opencodeReady ||
		prev.previewUrl !== next.previewUrl ||
		prev.message !== next.message ||
		prev.setupError !== next.setupError ||
		prev.initialPromptCompleted !== next.initialPromptCompleted ||
		prev.userPromptCompleted !== next.userPromptCompleted ||
		prev.userPromptMessageId !== next.userPromptMessageId ||
		prev.bootstrapSessionId !== next.bootstrapSessionId ||
		prev.prompt !== next.prompt ||
		prev.opencodeDiagnostic?.category !== next.opencodeDiagnostic?.category ||
		prev.production.status !== next.production.status ||
		prev.production.url !== next.production.url ||
		prev.production.error !== next.production.error ||
		prev.production.activeJobType !== next.production.activeJobType
	);
}
