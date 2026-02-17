import {
	AlertCircle,
	ChevronDown,
	ChevronUp,
	RefreshCw,
	Settings,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
	OpencodeDiagnostic,
	RemediationAction,
} from "@/server/opencode/diagnostics";

interface ChatDiagnosticProps {
	diagnostic: OpencodeDiagnostic;
	onDismiss?: () => void;
	onRetry?: () => void;
}

function getCategoryBadgeVariant(
	category: OpencodeDiagnostic["category"],
): "default" | "destructive" | "outline" {
	switch (category) {
		case "auth":
		case "runtime_unreachable":
			return "destructive";
		case "provider_model":
			return "outline";
		default:
			return "default";
	}
}

export function ChatDiagnostic({
	diagnostic,
	onDismiss,
	onRetry,
}: ChatDiagnosticProps) {
	const [showDetails, setShowDetails] = useState(false);

	const handleRemediationClick = (action: RemediationAction) => {
		if (action.href) {
			window.location.href = action.href;
			toast.info(`Navigating to ${action.label}...`);
			return;
		}

		if (!action.action) return;

		switch (action.action) {
			case "retry":
				onRetry?.();
				toast.success("Retrying your request...");
				break;
			case "reconnectProvider":
				toast.info("Reconnecting provider...");
				break;
			case "restartProject":
				toast.info("Restarting project containers...");
				break;
			case "simplify":
				toast.info(
					"Try a simpler prompt or break your request into smaller tasks",
				);
				break;
			case "wait":
				toast.info("Please wait for the service to become available");
				break;
			default:
				toast.info(`${action.label} action triggered`);
		}
	};

	const badgeVariant = getCategoryBadgeVariant(diagnostic.category);

	return (
		<div
			data-testid="chat-diagnostic"
			className="my-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4"
		>
			<div className="flex items-start gap-3">
				<AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive mt-0.5" />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h4 className="font-medium text-sm">{diagnostic.title}</h4>
						<Badge variant={badgeVariant} className="text-xs">
							{diagnostic.category}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground mt-1">
						{diagnostic.message}
					</p>

					{diagnostic.remediation.length > 0 && (
						<div className="flex flex-wrap gap-2 mt-3">
							{diagnostic.remediation.map((action) => (
								<RemediationActionButton
									key={action.id}
									action={action}
									onClick={() => handleRemediationClick(action)}
								/>
							))}
						</div>
					)}

					{diagnostic.technicalDetails && (
						<div className="mt-3">
							<button
								type="button"
								onClick={() => setShowDetails(!showDetails)}
								className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
							>
								{showDetails ? (
									<ChevronUp className="h-3 w-3" />
								) : (
									<ChevronDown className="h-3 w-3" />
								)}
								{showDetails ? "Hide details" : "Show details"}
							</button>

							{showDetails && (
								<div className="mt-2 p-2 rounded bg-muted/50 text-xs font-mono overflow-auto max-h-32">
									<div className="text-muted-foreground">
										<div>Error: {diagnostic.technicalDetails.errorName}</div>
										<div>
											Message: {diagnostic.technicalDetails.errorMessage}
										</div>
										{diagnostic.technicalDetails.stack && (
											<details className="mt-2">
												<summary className="cursor-pointer hover:text-foreground">
													Stack trace
												</summary>
												<pre className="mt-1 whitespace-pre-wrap break-all">
													{diagnostic.technicalDetails.stack}
												</pre>
											</details>
										)}
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{onDismiss && (
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={onDismiss}
						className="flex-shrink-0 -mt-1 -mr-1"
						title="Dismiss"
					>
						<X className="h-3 w-3" />
					</Button>
				)}
			</div>
		</div>
	);
}

interface RemediationActionButtonProps {
	action: RemediationAction;
	onClick: () => void;
}

function RemediationActionButton({
	action,
	onClick,
}: RemediationActionButtonProps) {
	const getIcon = () => {
		if (action.action === "retry") return <RefreshCw className="h-3 w-3" />;
		if (action.href?.includes("settings"))
			return <Settings className="h-3 w-3" />;
		return null;
	};

	const icon = getIcon();

	return (
		<Button
			size="sm"
			variant={action.href ? "outline" : "secondary"}
			onClick={onClick}
			title={action.description}
			className="gap-1"
		>
			{icon}
			{action.label}
		</Button>
	);
}
