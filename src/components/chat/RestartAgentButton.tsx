import { actions } from "astro:actions";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useProjectOptimisticState } from "@/stores/useProjectOptimisticState";

interface RestartAgentButtonProps {
	projectId: string;
	size?: "default" | "sm" | "lg" | "icon";
	variant?:
		| "default"
		| "destructive"
		| "outline"
		| "secondary"
		| "ghost"
		| "link";
	disabled?: boolean;
}

export function RestartAgentButton({
	projectId,
	size = "default",
	variant = "outline",
	disabled = false,
}: RestartAgentButtonProps) {
	const markRestartingAgent = useProjectOptimisticState(
		(s) => s.markRestartingAgent,
	);
	const clearPending = useProjectOptimisticState((s) => s.clearPending);
	const isRestarting = useProjectOptimisticState(
		(s) => s.pendingByProjectId.get(projectId)?.action === "restarting-agent",
	);

	const handleRestart = async () => {
		markRestartingAgent(projectId);

		try {
			const result = await actions.projects.restartOpencode({
				projectId,
			});

			if (result.data?.success) {
				toast.success("AI agent restarted", {
					description: "The agent is ready",
				});
			} else {
				toast.error("Failed to restart AI agent");
			}
		} catch (error) {
			toast.error("Failed to restart AI agent", {
				description:
					error instanceof Error
						? error.message
						: "An unexpected error occurred",
			});
		} finally {
			clearPending(projectId);
		}
	};

	return (
		<Button
			variant={variant}
			size={size}
			onClick={handleRestart}
			disabled={disabled || isRestarting}
			className="gap-2"
		>
			{isRestarting ? (
				<RefreshCw className="h-4 w-4 animate-spin" />
			) : (
				<AlertCircle className="h-4 w-4" />
			)}
			{isRestarting ? "Restarting..." : "Restart Agent"}
		</Button>
	);
}
