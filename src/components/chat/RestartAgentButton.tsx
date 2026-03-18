import { actions } from "astro:actions";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
	const [isRestarting, setIsRestarting] = useState(false);

	const handleRestart = async () => {
		setIsRestarting(true);
		const toastId = toast.loading("Restarting AI agent...");

		try {
			const result = await actions.projects.restartOpencode({
				projectId,
			});

			if (result.data?.success) {
				toast.success("AI agent restarted successfully", {
					id: toastId,
					description: "The agent is now ready to process your requests",
				});
			} else {
				toast.error("Failed to restart AI agent", {
					id: toastId,
					description: "Please try again or check the logs",
				});
			}
		} catch (error) {
			toast.error("Failed to restart AI agent", {
				id: toastId,
				description:
					error instanceof Error
						? error.message
						: "An unexpected error occurred",
			});
		} finally {
			setIsRestarting(false);
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
