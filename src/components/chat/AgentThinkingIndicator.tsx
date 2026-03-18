import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { RestartAgentButton } from "./RestartAgentButton";

const AGENT_RESPONSE_TIMEOUT_MS = 30_000;

interface AgentThinkingIndicatorProps {
	projectId: string;
	isWaiting: boolean;
	opencodeReady: boolean;
}

/**
 * Shows a "thinking" indicator after a user message when the agent
 * hasn't responded yet. After a timeout, shows an error with a restart button.
 */
export function AgentThinkingIndicator({
	projectId,
	isWaiting,
	opencodeReady,
}: AgentThinkingIndicatorProps) {
	const [timedOut, setTimedOut] = useState(false);

	useEffect(() => {
		if (!isWaiting) {
			setTimedOut(false);
			return;
		}

		const timer = setTimeout(() => {
			setTimedOut(true);
		}, AGENT_RESPONSE_TIMEOUT_MS);

		return () => clearTimeout(timer);
	}, [isWaiting]);

	if (!isWaiting) return null;

	if (timedOut || !opencodeReady) {
		return (
			<div className="flex items-start gap-3 px-4 py-3">
				<div className="flex flex-col gap-2 w-full">
					<div className="flex items-center gap-2 text-status-error">
						<AlertCircle className="h-4 w-4 shrink-0" />
						<span className="text-sm font-medium">
							{!opencodeReady
								? "AI agent is not reachable"
								: "AI agent is not responding"}
						</span>
					</div>
					<p className="text-xs text-muted-foreground">
						The agent may have crashed or encountered an error.
					</p>
					<RestartAgentButton projectId={projectId} size="sm" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 px-4 py-3 text-muted-foreground">
			<Loader2 className="h-4 w-4 animate-spin" />
			<span className="text-sm">Thinking...</span>
		</div>
	);
}
