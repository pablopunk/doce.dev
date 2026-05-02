import { useEffect, useState } from "react";
import type { ChecklistItem } from "@/components/setup/SetupChecklist";
import { useLiveState } from "./useLiveState";

const STARTUP_TIMEOUT_MS = 120_000;

interface UseStartupChecklistItemsResult {
	items: ChecklistItem[];
	allReady: boolean;
	fatalError: string | null;
}

export function useStartupChecklistItems(
	projectId: string,
): UseStartupChecklistItemsResult {
	const { data } = useLiveState(`/api/projects/${projectId}/live`);
	const [timedOut, setTimedOut] = useState(false);

	const status = data?.status ?? "starting";
	const previewReady = data?.previewReady ?? false;
	const opencodeReady = data?.opencodeReady ?? false;
	const setupError = data?.setupError ?? null;
	const message = data?.message;

	const allReady = status === "running" && previewReady && opencodeReady;

	useEffect(() => {
		const id = setTimeout(() => {
			if (!allReady) setTimedOut(true);
		}, STARTUP_TIMEOUT_MS);
		return () => clearTimeout(id);
	}, [allReady]);

	const fatalError =
		status === "error" || setupError
			? (setupError ?? "Startup failed")
			: timedOut
				? "Timeout waiting for containers to start"
				: null;

	const items: ChecklistItem[] = [
		{
			id: "docker",
			label: "Docker",
			status: previewReady ? "ready" : "running",
			detail: previewReady ? undefined : (message ?? "Starting containers..."),
		},
		{
			id: "agent",
			label: "Agent",
			status: opencodeReady ? "ready" : previewReady ? "running" : "pending",
			detail: opencodeReady
				? undefined
				: previewReady
					? "Waiting for opencode..."
					: undefined,
		},
	];

	return { items, allReady, fatalError };
}
