import type { QueueJob } from "@/server/db/schema";
import { isGlobalOpencodeHealthy } from "@/server/opencode/runtime";
import {
	countJobs,
	getConcurrency,
	isQueuePaused,
	listJobs,
} from "@/server/queue/queue.model";
import type { QueueJobType } from "@/server/queue/types";
import { runCommand } from "@/server/utils/execAsync";

const PAGE_SIZE = 25;
const DOCE_SHARED_NETWORK = process.env.DOCE_NETWORK || "doce-shared";
const GLOBAL_PNPM_VOLUME = "doce-global-pnpm-store";

export interface QueueStatusFilters {
	state?: string;
	type?: string;
	projectId?: string;
	q?: string;
	page?: string;
}

export interface QueueStatusPageData {
	jobs: QueueJob[];
	paused: boolean;
	concurrency: number;
	pagination: {
		page: number;
		pageSize: number;
		totalCount: number;
		totalPages: number;
	};
	filters: {
		state?: string;
		type?: string;
		projectId?: string;
		q?: string;
	};
}

export interface StatusDiagnosticItem {
	label: string;
	status: "healthy" | "warning";
	value: string;
	description: string;
}

export interface SettingsStatusDiagnostics {
	version: string;
	queue: {
		paused: boolean;
		concurrency: number;
		queuedJobs: number;
		runningJobs: number;
		failedJobs: number;
	};
	checks: StatusDiagnosticItem[];
}

function validateJobState(stateParam: string): QueueJob["state"] | undefined {
	const allowedStates = [
		"queued",
		"running",
		"succeeded",
		"failed",
		"cancelled",
	] as const;
	return allowedStates.includes(stateParam as QueueJob["state"])
		? (stateParam as QueueJob["state"])
		: undefined;
}

function validateJobType(typeParam: string): QueueJobType | undefined {
	const allowedTypes = [
		"project.create",
		"project.delete",
		"projects.deleteAllForUser",
		"docker.composeUp",
		"docker.waitReady",
		"docker.ensureRunning",
		"docker.stop",
		"opencode.sessionCreate",
		"opencode.sendInitialPrompt",
		"opencode.sendUserPrompt",
		"production.build",
		"production.start",
		"production.waitReady",
		"production.stop",
		"app.update",
		"app.restart",
	] as const;

	return allowedTypes.includes(typeParam as QueueJobType)
		? (typeParam as QueueJobType)
		: undefined;
}

async function checkDockerResource(command: string): Promise<boolean> {
	const result = await runCommand(command, { timeout: 5000 });
	return result.success;
}

export async function getQueueStatusPageData(
	searchParams: QueueStatusFilters,
): Promise<QueueStatusPageData> {
	const stateParam = searchParams.state ?? "";
	const typeParam = searchParams.type ?? "";
	const projectIdParam = searchParams.projectId ?? "";
	const qParam = searchParams.q ?? "";
	const pageParam = searchParams.page ?? "1";

	const state = validateJobState(stateParam);
	const type = validateJobType(typeParam);
	const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);
	const offset = (page - 1) * PAGE_SIZE;
	const filters: Parameters<typeof listJobs>[0] = {
		limit: PAGE_SIZE,
		offset,
	};

	if (state) filters.state = state;
	if (type) filters.type = type;
	if (projectIdParam) filters.projectId = projectIdParam;
	if (qParam) filters.q = qParam;

	const paused = await isQueuePaused();
	const concurrency = await getConcurrency();
	const jobs = await listJobs(filters);
	const countFilters: Omit<
		Parameters<typeof countJobs>[0],
		"limit" | "offset"
	> = {};
	if (state) countFilters.state = state;
	if (type) countFilters.type = type;
	if (projectIdParam) countFilters.projectId = projectIdParam;
	if (qParam) countFilters.q = qParam;
	const totalCount = await countJobs(countFilters);

	return {
		jobs,
		paused,
		concurrency,
		pagination: {
			page,
			pageSize: PAGE_SIZE,
			totalCount,
			totalPages: Math.ceil(totalCount / PAGE_SIZE),
		},
		filters: Object.fromEntries(
			Object.entries({
				state: stateParam || undefined,
				type: typeParam || undefined,
				projectId: projectIdParam || undefined,
				q: qParam || undefined,
			}).filter(([, value]) => value !== undefined),
		),
	};
}

export async function getSettingsStatusDiagnostics(): Promise<SettingsStatusDiagnostics> {
	const [
		paused,
		concurrency,
		queuedJobs,
		runningJobs,
		failedJobs,
		opencodeHealthy,
		dockerHealthy,
		networkHealthy,
		volumeHealthy,
	] = await Promise.all([
		isQueuePaused(),
		getConcurrency(),
		countJobs({ state: "queued" }),
		countJobs({ state: "running" }),
		countJobs({ state: "failed" }),
		isGlobalOpencodeHealthy(),
		checkDockerResource("docker version"),
		checkDockerResource(`docker network inspect ${DOCE_SHARED_NETWORK}`),
		checkDockerResource(`docker volume inspect ${GLOBAL_PNPM_VOLUME}`),
	]);

	return {
		version: process.env.VERSION || "unknown",
		queue: {
			paused,
			concurrency,
			queuedJobs,
			runningJobs,
			failedJobs,
		},
		checks: [
			{
				label: "Docker daemon",
				status: dockerHealthy ? "healthy" : "warning",
				value: dockerHealthy ? "Connected" : "Unavailable",
				description: "Access to the host Docker engine from the app container.",
			},
			{
				label: "OpenCode runtime",
				status: opencodeHealthy ? "healthy" : "warning",
				value: opencodeHealthy ? "Ready" : "Not ready",
				description: "Central OpenCode server used for project chat and edits.",
			},
			{
				label: "Shared network",
				status: networkHealthy ? "healthy" : "warning",
				value: networkHealthy ? DOCE_SHARED_NETWORK : "Missing",
				description:
					"Docker network used for app, preview, and production containers.",
			},
			{
				label: "Global pnpm volume",
				status: volumeHealthy ? "healthy" : "warning",
				value: volumeHealthy ? GLOBAL_PNPM_VOLUME : "Missing",
				description:
					"Shared dependency cache volume for preview and production builds.",
			},
		],
	};
}
