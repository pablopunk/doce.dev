import { actions } from "astro:actions";
import { useState } from "react";
import { useSetupChecklistItems } from "@/hooks/useSetupChecklistItems";
import { SetupChecklist } from "./SetupChecklist";

interface SetupStatusDisplayProps {
	projectId: string;
}

export function SetupStatusDisplay({ projectId }: SetupStatusDisplayProps) {
	const { items, hasError, errorMessage, jobTimeoutWarning } =
		useSetupChecklistItems(projectId);
	const [isRestarting, setIsRestarting] = useState(false);
	const [restartError, setRestartError] = useState<string | null>(null);

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
