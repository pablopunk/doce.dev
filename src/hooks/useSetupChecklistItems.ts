import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckStatus } from "@/components/setup/CheckRow";
import type { ChecklistItem } from "@/components/setup/SetupChecklist";
import { useLiveState } from "./useLiveState";

const AGENT_TIMEOUT_MS = 5 * 60 * 1000;

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
	const { data: liveData } = useLiveState(`/api/projects/${projectId}/live`);
	const [agentMessage, setAgentMessage] = useState<string>("");
	const [agentTimedOut, setAgentTimedOut] = useState(false);
	const promptSentAtRef = useRef<number | null>(null);

	const allReady = liveData?.userPromptCompleted ?? false;
	const hasError =
		liveData?.status === "error" || Boolean(liveData?.setupError);
	const errorMessage =
		liveData?.setupError ??
		(liveData?.status === "error"
			? (liveData.message ?? "Setup failed")
			: null);
	const jobTimeoutWarning = null;

	useEffect(() => {
		if (liveData?.initialPromptSent && !promptSentAtRef.current) {
			promptSentAtRef.current = Date.now();
		}
	}, [liveData?.initialPromptSent]);

	useEffect(() => {
		if (!allReady) {
			return;
		}

		const timeoutId = setTimeout(() => window.location.reload(), 1000);
		return () => clearTimeout(timeoutId);
	}, [allReady]);

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

	useEffect(() => {
		if (!promptSentAtRef.current || agentTimedOut) {
			return;
		}

		const remainingMs = Math.max(
			0,
			AGENT_TIMEOUT_MS - (Date.now() - promptSentAtRef.current),
		);
		const timeoutId = setTimeout(() => {
			setAgentTimedOut(true);
		}, remainingMs);
		return () => clearTimeout(timeoutId);
	}, [agentTimedOut]);

	const items = buildItems(liveData, {
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

function lastTrimmedLine(text: string): string | undefined {
	const trimmed = text.trim();
	if (!trimmed) return undefined;
	const lines = trimmed.split("\n");
	return lines[lines.length - 1];
}

function buildItems(
	liveData: {
		status?: string;
		previewReady?: boolean;
		initialPromptSent?: boolean;
		userPromptCompleted?: boolean;
		setupError?: string | null;
		message?: string | null;
	} | null,
	ctx: { agentMessage: string; agentTimedOut: boolean },
): ChecklistItem[] {
	const filesItem: ChecklistItem = {
		id: "files",
		label: "Project files",
		status: "ready",
	};

	const dockerStatus: CheckStatus =
		liveData?.status === "error"
			? "error"
			: liveData?.previewReady
				? "ready"
				: "running";
	const dockerItem: ChecklistItem = {
		id: "docker",
		label: "Docker",
		status: dockerStatus,
		detail:
			dockerStatus === "error"
				? (liveData?.setupError ??
					liveData?.message ??
					"Docker failed to start")
				: dockerStatus === "running"
					? (liveData?.message ?? "Starting containers...")
					: undefined,
	};

	const streamed = lastTrimmedLine(ctx.agentMessage);
	const agentStatus: CheckStatus =
		liveData?.status === "error"
			? "error"
			: liveData?.userPromptCompleted
				? "ready"
				: liveData?.previewReady || liveData?.initialPromptSent
					? "running"
					: "pending";
	let agentDetail: string | undefined;
	if (agentStatus === "error") {
		agentDetail = liveData?.setupError ?? "Agent failed";
	} else if (agentStatus === "running") {
		agentDetail =
			streamed ??
			(liveData?.initialPromptSent
				? ctx.agentTimedOut
					? "Agent is taking longer than expected. Still working..."
					: "Leveraging agent..."
				: "Preparing agent session...");
	}
	const agentItem: ChecklistItem = {
		id: "agent",
		label: "Agent",
		status: agentStatus,
		detail: agentDetail,
	};

	return [filesItem, dockerItem, agentItem];
}
