import { AlertCircle } from "lucide-react";
import { RestartAgentButton } from "./RestartAgentButton";

interface AgentUnreachableBannerProps {
	projectId: string;
}

/**
 * Banner shown in the chat area when OpenCode becomes unreachable
 * after the chat was already active (items exist).
 */
export function AgentUnreachableBanner({
	projectId,
}: AgentUnreachableBannerProps) {
	return (
		<div className="mx-4 my-3 rounded-lg border border-status-error/30 bg-status-error/5 p-4">
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-2 text-status-error">
					<AlertCircle className="h-4 w-4 shrink-0" />
					<span className="text-sm font-medium">AI agent disconnected</span>
				</div>
				<p className="text-xs text-muted-foreground">
					The AI agent has stopped responding. This can happen if the server
					crashed or restarted. Try restarting it below.
				</p>
				<RestartAgentButton projectId={projectId} size="sm" />
			</div>
		</div>
	);
}
