import { actions } from "astro:actions";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckStatus } from "@/components/setup/CheckRow";
import type { ChecklistItem } from "@/components/setup/SetupChecklist";

const POLL_INTERVAL_MS = 2500;
const AGENT_TIMEOUT_MS = 5 * 60 * 1000;

type JobState =
	| "pending"
	| "queued"
	| "running"
	| "succeeded"
	| "failed"
	| "exhausted";
type SetupJob = { type: string; state: JobState; error?: string };
type SetupJobs = Record<string, SetupJob>;

interface UseSetupChecklistItemsResult {
	items: ChecklistItem[];
	allReady: boolean;
	hasError: boolean;
	errorMessage: string | null;
	jobTimeoutWarning: string | null;
}

export function useSetupChecklistItems(
	projectId: string,
): UseSetupChecklistItemsResult {
	const [setupJobs, setSetupJobs] = useState<SetupJobs>({});
	const [hasError, setHasError] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [allReady, setAllReady] = useState(false);
	const [jobTimeoutWarning, setJobTimeoutWarning] = useState<string | null>(
		null,
	);
	const [agentMessage, setAgentMessage] = useState<string>("");
	const [agentTimedOut, setAgentTimedOut] = useState(false);
	const promptSentAtRef = useRef<number | null>(null);

	// Poll queue status
	useEffect(() => {
		if (allReady) return;
		let cancelled = false;

		const poll = async () => {
			try {
				const { data, error } = await actions.projects.getQueueStatus({
					projectId,
				});
				if (cancelled) return;
				if (error) {
					setHasError(true);
					setErrorMessage("Failed to check setup status");
					return;
				}
				setSetupJobs(data.setupJobs as SetupJobs);
				setHasError(data.hasError);
				setErrorMessage(data.errorMessage ?? null);
				setJobTimeoutWarning(data.jobTimeoutWarning ?? null);
				if (data.promptSentAt && !promptSentAtRef.current) {
					promptSentAtRef.current = data.promptSentAt;
				}
				if (data.currentStep >= 4) {
					setAllReady(true);
					setTimeout(() => window.location.reload(), 1000);
				}
			} catch {
				// ignore transient errors
			}
		};

		poll();
		const id = setInterval(poll, POLL_INTERVAL_MS);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [projectId, allReady]);

	// SSE for agent streaming detail
	const handleEvent = useCallback(
		(event: { type: string; payload: Record<string, unknown> }) => {
			const { type, payload } = event;
			if (type === "chat.message.part.added" || type === "chat.message.delta") {
				const deltaText = (payload as { deltaText?: string }).deltaText;
				if (deltaText) setAgentMessage((prev) => prev + deltaText);
			}
		},
		[],
	);

	useEffect(() => {
		if (allReady) return;
		const es = new EventSource(`/api/projects/${projectId}/opencode/event`);
		es.addEventListener("chat.event", (e) => {
			try {
				handleEvent(JSON.parse((e as MessageEvent).data));
			} catch {
				// ignore
			}
		});
		es.onerror = () => es.close();
		return () => es.close();
	}, [projectId, allReady, handleEvent]);

	// Agent slow warning after 5 min
	useEffect(() => {
		const id = setInterval(() => {
			if (
				promptSentAtRef.current &&
				Date.now() - promptSentAtRef.current > AGENT_TIMEOUT_MS
			) {
				setAgentTimedOut(true);
			}
		}, 30_000);
		return () => clearInterval(id);
	}, []);

	const items = buildItems(setupJobs, {
		agentMessage,
		agentTimedOut,
	});

	return {
		items,
		allReady,
		hasError,
		errorMessage,
		jobTimeoutWarning,
	};
}

function jobStatus(state: JobState | undefined): CheckStatus {
	if (!state || state === "pending" || state === "queued") return "pending";
	if (state === "running") return "running";
	if (state === "succeeded") return "ready";
	return "error";
}

function combineStatus(...statuses: CheckStatus[]): CheckStatus {
	if (statuses.includes("error")) return "error";
	if (statuses.includes("running")) return "running";
	if (statuses.every((s) => s === "ready")) return "ready";
	if (statuses.includes("ready")) return "running";
	return "pending";
}

function lastTrimmedLine(text: string): string | undefined {
	const trimmed = text.trim();
	if (!trimmed) return undefined;
	const lines = trimmed.split("\n");
	return lines[lines.length - 1];
}

function buildItems(
	jobs: SetupJobs,
	ctx: { agentMessage: string; agentTimedOut: boolean },
): ChecklistItem[] {
	const filesJob = jobs["project.create"];
	const composeJob = jobs["docker.composeUp"];
	const ensureJob = jobs["docker.ensureRunning"];
	const waitJob = jobs["docker.waitReady"];
	const sessionJob = jobs["opencode.sessionCreate"];
	const promptJob = jobs["opencode.sendUserPrompt"];

	// Files
	const filesStatus = jobStatus(filesJob?.state);
	const filesItem: ChecklistItem = {
		id: "files",
		label: "Project files",
		status: filesStatus,
		detail:
			filesStatus === "error"
				? (filesJob?.error ?? "Failed to create project files")
				: filesStatus === "running"
					? "Creating project files..."
					: undefined,
	};

	// Docker — composeUp/ensureRunning + waitReady combined.
	// ensureRunning supersedes composeUp/waitReady when active.
	const ensureState = ensureJob?.state;
	const ensureActive =
		ensureState === "queued" ||
		ensureState === "running" ||
		ensureState === "succeeded";
	const dockerBringup = ensureActive
		? jobStatus(ensureJob?.state)
		: jobStatus(composeJob?.state);
	const dockerHealth =
		ensureState === "succeeded"
			? ("ready" as CheckStatus)
			: jobStatus(waitJob?.state);
	const dockerStatus = combineStatus(dockerBringup, dockerHealth);
	const dockerError =
		(ensureActive ? ensureJob?.error : composeJob?.error) ?? waitJob?.error;
	const dockerItem: ChecklistItem = {
		id: "docker",
		label: "Docker",
		status: dockerStatus,
		detail:
			dockerStatus === "error"
				? (dockerError ?? "Docker failed to start")
				: dockerStatus === "running"
					? dockerBringup === "ready"
						? "Waiting for containers to be healthy..."
						: "Starting containers..."
					: undefined,
	};

	// Agent — session + prompt combined.
	const sessionStatus = jobStatus(sessionJob?.state);
	const promptStatus = jobStatus(promptJob?.state);
	const agentStatus = combineStatus(sessionStatus, promptStatus);
	const agentError = sessionJob?.error ?? promptJob?.error;
	let agentDetail: string | undefined;
	if (agentStatus === "error") {
		agentDetail = agentError ?? "Agent failed";
	} else if (agentStatus === "running") {
		if (sessionStatus !== "ready") {
			agentDetail = "Creating agent session...";
		} else {
			const streamed = lastTrimmedLine(ctx.agentMessage);
			agentDetail =
				streamed ??
				(ctx.agentTimedOut
					? "Agent is taking longer than expected. Still waiting..."
					: "Leveraging agent...");
		}
	}
	const agentItem: ChecklistItem = {
		id: "agent",
		label: "Agent",
		status: agentStatus,
		detail: agentDetail,
	};

	return [filesItem, dockerItem, agentItem];
}
