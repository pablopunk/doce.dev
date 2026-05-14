import * as path from "node:path";
import { composePs, parseComposePs, runComposeCommand } from "@/server/docker/compose";
import {
	extractLastErrorLine,
	readLogFromOffset,
	readLogTail,
} from "@/server/docker/logs";
import { logger } from "@/server/logger";
import { checkPreviewReady } from "@/server/projects/health";
import { getProjectPreviewPath } from "@/server/projects/paths";
import { getProjectById } from "@/server/projects/projects.model";
import type {
	GetDocePreviewStatusInput,
	GetDocePreviewStatusOutput,
	ReadDocePreviewLogsInput,
	ReadDocePreviewLogsOutput,
	RestartDocePreviewInput,
	RestartDocePreviewOutput,
} from "./schemas";

// ============================================================================
// get_doce_preview_status
// ============================================================================

export async function getDocePreviewStatus(
	input: GetDocePreviewStatusInput,
	userId: string,
): Promise<GetDocePreviewStatusOutput> {
	const { projectId } = input;

	const project = await loadAndVerifyProject(projectId, userId);
	if (!project) {
		return buildErrorStatus(projectId, "Project not found or access denied");
	}

	const previewPath = getProjectPreviewPath(projectId);
	const composeResult = await composePs(projectId, previewPath);
	const containers = composeResult.success
		? parseComposePs(composeResult.stdout)
		: [];

	const previewReachable = await checkPreviewReady(projectId);

	const summary = buildStatusSummary({
		projectStatus: project.status,
		previewReachable,
		containers,
	});

	return {
		ok: true,
		projectId,
		projectStatus: project.status,
		preview: {
			reachable: previewReachable,
		},
		containers: containers.map((c) => ({
			service: c.service,
			state: c.state,
			health: c.health,
		})),
		summary,
	};
}

function buildStatusSummary(args: {
	projectStatus: string;
	previewReachable: boolean;
	containers: Array<{ service: string; state: string }>;
}): string {
	if (args.previewReachable) {
		return "Preview is reachable and serving traffic.";
	}

	const previewContainer = args.containers.find((c) => c.service === "preview");
	if (!previewContainer) {
		return "Preview container not found; containers may not be running.";
	}

	if (previewContainer.state !== "running") {
		return `Preview container is ${previewContainer.state}.`;
	}

	return "Preview container is running but not responding to health checks.";
}

function buildErrorStatus(
	projectId: string,
	message: string,
): GetDocePreviewStatusOutput {
	return {
		ok: false,
		projectId,
		projectStatus: "unknown",
		preview: { reachable: false },
		containers: [],
		summary: message,
	};
}

// ============================================================================
// read_doce_preview_logs
// ============================================================================

export async function readDocePreviewLogs(
	input: ReadDocePreviewLogsInput,
	userId: string,
): Promise<ReadDocePreviewLogsOutput> {
	const { projectId, mode, maxBytes = 8192, offset } = input;

	const project = await loadAndVerifyProject(projectId, userId);
	if (!project) {
		return buildErrorLogs(projectId, mode, "Project not found or access denied");
	}

	const previewPath = getProjectPreviewPath(projectId);
	const logsDir = path.join(previewPath, "logs");

	try {
		if (mode === "summary") {
			return await readLogsSummary(projectId, logsDir);
		}

		if (mode === "tail") {
			return await readLogsTail(projectId, logsDir, maxBytes);
		}

		if (mode === "sinceOffset" && offset !== undefined) {
			return await readLogsSince(projectId, logsDir, offset);
		}

		return buildErrorLogs(projectId, mode, "Invalid offset for sinceOffset mode");
	} catch (error) {
		logger.error({ error, projectId, mode }, "Failed to read preview logs");
		return buildErrorLogs(
			projectId,
			mode,
			error instanceof Error ? error.message : "Unknown error",
		);
	}
}

async function readLogsSummary(
	projectId: string,
	logsDir: string,
): Promise<ReadDocePreviewLogsOutput> {
	const signal = await extractLastErrorLine(logsDir);

	return {
		ok: true,
		projectId,
		mode: "summary",
		extractedSignal: signal,
		summary: signal
			? `Last error found in recent logs: ${signal}`
			: "No obvious error found in recent logs.",
	};
}

async function readLogsTail(
	projectId: string,
	logsDir: string,
	maxBytes: number,
): Promise<ReadDocePreviewLogsOutput> {
	const { content, offset, truncated } = await readLogTail(logsDir, maxBytes);
	const signal = await extractLastErrorLine(logsDir);

	return {
		ok: true,
		projectId,
		mode: "tail",
		content,
		nextOffset: offset,
		truncated,
		extractedSignal: signal,
		summary: signal
			? `Returned recent log tail; likely issue: ${signal}`
			: "Returned recent log tail; no obvious error detected.",
	};
}

async function readLogsSince(
	projectId: string,
	logsDir: string,
	offset: number,
): Promise<ReadDocePreviewLogsOutput> {
	const { content, nextOffset } = await readLogFromOffset(logsDir, offset);

	return {
		ok: true,
		projectId,
		mode: "sinceOffset",
		content,
		nextOffset,
		summary: content
			? `Read ${content.length} bytes of new log content.`
			: "No new log content since last offset.",
	};
}

function buildErrorLogs(
	projectId: string,
	mode: string,
	message: string,
): ReadDocePreviewLogsOutput {
	return {
		ok: false,
		projectId,
		mode: mode as "summary" | "tail" | "sinceOffset",
		summary: message,
	};
}

// ============================================================================
// restart_doce_preview
// ============================================================================

const RESTART_CHECK_TIMEOUT_MS = 30_000;
const RESTART_CHECK_INTERVAL_MS = 1000;

export async function restartDocePreview(
	input: RestartDocePreviewInput,
	userId: string,
): Promise<RestartDocePreviewOutput> {
	const { projectId, reason } = input;

	logger.info({ projectId, reason }, "Restarting preview container");

	const project = await loadAndVerifyProject(projectId, userId);
	if (!project) {
		return buildErrorRestart(projectId, "Project not found or access denied");
	}

	const previewPath = getProjectPreviewPath(projectId);

	const result = await runComposeCommand(projectId, previewPath, [
		"restart",
		"preview",
	]);

	if (!result.success) {
		logger.error(
			{ projectId, error: result.stderr },
			"Failed to restart preview container",
		);
		return buildErrorRestart(
			projectId,
			`Restart command failed: ${result.stderr.slice(0, 200)}`,
		);
	}

	const reachable = await waitForPreviewReady(projectId);

	return {
		ok: reachable,
		projectId,
		restarted: true,
		command: "docker compose restart preview",
		previewReachableAfterRestart: reachable,
		summary: reachable
			? "Preview restarted successfully and is reachable."
			: "Restart command succeeded but preview is still unhealthy.",
	};
}

async function waitForPreviewReady(projectId: string): Promise<boolean> {
	const deadline = Date.now() + RESTART_CHECK_TIMEOUT_MS;

	while (Date.now() < deadline) {
		if (await checkPreviewReady(projectId)) {
			return true;
		}
		await sleep(RESTART_CHECK_INTERVAL_MS);
	}

	return false;
}

function buildErrorRestart(
	projectId: string,
	message: string,
): RestartDocePreviewOutput {
	return {
		ok: false,
		projectId,
		restarted: false,
		command: "docker compose restart preview",
		previewReachableAfterRestart: false,
		summary: message,
		error: message,
	};
}

// ============================================================================
// Shared helpers
// ============================================================================

async function loadAndVerifyProject(projectId: string, userId: string) {
	const project = await getProjectById(projectId);
	if (!project || project.ownerUserId !== userId) {
		return null;
	}
	return project;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
