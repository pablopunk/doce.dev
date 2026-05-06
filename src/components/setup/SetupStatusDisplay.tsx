import { actions } from "astro:actions";
import { useEffect, useRef, useState } from "react";
import { useLiveState } from "@/hooks/useLiveState";
import { useSetupChecklistItems } from "@/hooks/useSetupChecklistItems";
import { SetupChecklist } from "./SetupChecklist";

interface SetupStatusDisplayProps {
	projectId: string;
}

export function SetupStatusDisplay({ projectId }: SetupStatusDisplayProps) {
	const { items, hasError, errorMessage, jobTimeoutWarning } =
		useSetupChecklistItems(projectId);
	const { data: liveData } = useLiveState(`/api/projects/${projectId}/live`);
	const [isRestarting, setIsRestarting] = useState(false);
	const [restartError, setRestartError] = useState<string | null>(null);
	const projectContentOpenedRef = useRef(false);

	const handleRestart = async () => {
		setIsRestarting(true);
		setRestartError(null);
		try {
			const { error } = await actions.projects.restart({ projectId });
			if (error) {
				setRestartError(error.message || "Failed to restart project");
			}
		} catch (err) {
			setRestartError(
				err instanceof Error ? err.message : "Failed to restart project",
			);
		} finally {
			setIsRestarting(false);
		}
	};

	useEffect(() => {
		if (projectContentOpenedRef.current) return;
		if (
			liveData?.initialPromptSent ||
			liveData?.bootstrapSessionId ||
			(liveData?.status === "running" && liveData?.opencodeReady)
		) {
			projectContentOpenedRef.current = true;
			window.location.reload();
		}
	}, [
		liveData?.bootstrapSessionId,
		liveData?.initialPromptSent,
		liveData?.opencodeReady,
		liveData?.status,
	]);

	const error =
		hasError || restartError
			? {
					message: restartError ?? errorMessage ?? "Setup failed",
					onRetry: handleRestart,
					retrying: isRestarting,
					retryLabel: "Retry Setup",
				}
			: null;

	return (
		<SetupChecklist
			heading="Setting up your project..."
			items={items}
			footerNote={jobTimeoutWarning ?? undefined}
			error={error}
		/>
	);
}
