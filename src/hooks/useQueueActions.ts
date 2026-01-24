import { useState } from "react";

export function useQueueActions() {
	const [isLoading, setIsLoading] = useState(false);
	const [pendingAction, setPendingAction] = useState<{
		jobId?: string;
		action: "cancel" | "forceUnlock" | "delete" | "deleteByState";
		state?: "succeeded" | "failed" | "cancelled";
		jobCount?: number;
	} | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [stopAllDialogOpen, setStopAllDialogOpen] = useState(false);

	const handleToggleQueue = async (isPaused: boolean) => {
		try {
			const action = isPaused
				? "/_actions/queue.resume"
				: "/_actions/queue.pause";
			const res = await fetch(action, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			if (!res.ok) {
				throw new Error("Failed to toggle queue");
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to toggle queue");
		}
	};

	const handleStopAll = () => {
		setStopAllDialogOpen(true);
	};

	const handleConfirmStopAll = async () => {
		setIsLoading(true);
		try {
			const res = await fetch("/_actions/queue.stopAll", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			if (!res.ok) {
				throw new Error("Failed to stop all projects");
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to stop all projects");
		} finally {
			setIsLoading(false);
		}
	};

	const handleActionClick = (
		action: "cancel" | "forceUnlock" | "delete",
		jobId: string,
	) => {
		setPendingAction({ jobId, action });
		setDialogOpen(true);
	};

	const handleBulkDelete = (
		state: "succeeded" | "failed" | "cancelled",
		jobCount: number,
	) => {
		setPendingAction({ action: "deleteByState", state, jobCount });
		setDialogOpen(true);
	};

	const handleConfirmAction = async () => {
		if (!pendingAction) return;

		setIsLoading(true);
		try {
			let path = "";
			let body: Record<string, string> = {};

			switch (pendingAction.action) {
				case "cancel": {
					path = "/_actions/queue.cancel";
					if (!pendingAction.jobId) {
						throw new Error("Job ID is required for cancel action");
					}
					body = { jobId: pendingAction.jobId };
					break;
				}
				case "forceUnlock": {
					path = "/_actions/queue.forceUnlock";
					if (!pendingAction.jobId) {
						throw new Error("Job ID is required for forceUnlock action");
					}
					body = { jobId: pendingAction.jobId };
					break;
				}
				case "delete": {
					if (!pendingAction.jobId) {
						throw new Error("Job ID is required for delete action");
					}
					path = "/_actions/queue.deleteJob";
					body = { jobId: pendingAction.jobId };
					break;
				}
				case "deleteByState": {
					if (!pendingAction.state) {
						throw new Error("State is required for deleteByState action");
					}
					path = "/_actions/queue.deleteByState";
					body = { state: pendingAction.state };
					break;
				}
				default:
					throw new Error("Invalid action");
			}

			const res = await fetch(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				throw new Error("Failed to perform action");
			}
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to perform action");
		} finally {
			setIsLoading(false);
			setPendingAction(null);
		}
	};

	const handleAction = async (action: string, jobId: string) => {
		if (action === "runNow") {
			try {
				const res = await fetch("/_actions/queue.runNow", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jobId }),
				});

				if (!res.ok) {
					throw new Error("Failed to run job");
				}
			} catch (err) {
				alert(err instanceof Error ? err.message : "Failed to run job");
			}
		} else if (action === "retry") {
			try {
				const res = await fetch("/_actions/queue.retry", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jobId }),
				});

				if (!res.ok) {
					throw new Error("Failed to retry job");
				}
			} catch (err) {
				alert(err instanceof Error ? err.message : "Failed to retry job");
			}
		} else if (
			action === "cancel" ||
			action === "forceUnlock" ||
			action === "delete"
		) {
			handleActionClick(action, jobId);
		}
	};

	return {
		isLoading,
		pendingAction,
		dialogOpen,
		stopAllDialogOpen,
		setDialogOpen,
		setStopAllDialogOpen,
		handleToggleQueue,
		handleStopAll,
		handleConfirmStopAll,
		handleActionClick,
		handleBulkDelete,
		handleConfirmAction,
		handleAction,
	};
}
