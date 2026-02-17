import {
	AlertCircle,
	ChevronDown,
	ChevronUp,
	RefreshCw,
	Settings,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	classifyThrownError,
	OPENCODE_ERROR_CATEGORY_METADATA,
	type OpencodeErrorCategory,
	type OpencodeErrorCategoryMetadata,
	type RemediationAction,
} from "@/server/opencode/diagnostics";

interface QueueDiagnosticProps {
	error: string | null;
	onRetry?: () => void;
}

function getCategoryFromError(error: string): {
	category: OpencodeErrorCategory;
	confidence: string;
} {
	const classification = classifyThrownError(new Error(error));
	return {
		category: classification.category as OpencodeErrorCategory,
		confidence: classification.confidence,
	};
}

function getCategoryBadgeVariant(
	category: OpencodeErrorCategory,
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

export function QueueDiagnostic({ error, onRetry }: QueueDiagnosticProps) {
	const [showDetails, setShowDetails] = useState(false);

	if (!error) return null;

	const { category } = getCategoryFromError(error);
	const metadata: OpencodeErrorCategoryMetadata =
		OPENCODE_ERROR_CATEGORY_METADATA[category] ?? {
			category,
			displayTitle: "Error",
			defaultMessage: "An error occurred",
			defaultRemediation: [],
			defaultRetryable: true,
		};
	const badgeVariant = getCategoryBadgeVariant(category);

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
				toast.success("Retrying job...");
				break;
			case "reconnectProvider":
				toast.info("Reconnecting provider...");
				break;
			case "restartProject":
				toast.info("Restarting project containers...");
				break;
			case "simplify":
				toast.info("Try a simpler prompt or task");
				break;
			case "wait":
				toast.info("Please wait for the service to become available");
				break;
			default:
				toast.info(`${action.label} action triggered`);
		}
	};

	const remediation: RemediationAction[] = metadata?.defaultRemediation ?? [];

	return (
		<div
			data-testid="queue-diagnostic"
			className="mt-6 rounded-lg border border-destructive/40 p-4"
		>
			<div className="flex items-start gap-3">
				<AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive mt-0.5" />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="font-semibold text-sm">
							{metadata?.displayTitle ?? "Error"}
						</h3>
						<Badge variant={badgeVariant} className="text-xs">
							{category}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground mt-1">
						{metadata?.defaultMessage ?? "An error occurred"}
					</p>

					{remediation.length > 0 && (
						<div className="flex flex-wrap gap-2 mt-3">
							{remediation.map((action: RemediationAction) => (
								<Button
									key={action.id}
									size="sm"
									variant={action.href ? "outline" : "secondary"}
									onClick={() => handleRemediationClick(action)}
									title={action.description}
									className="gap-1"
								>
									{action.action === "retry" ? (
										<RefreshCw className="h-3 w-3" />
									) : action.href?.includes("settings") ? (
										<Settings className="h-3 w-3" />
									) : null}
									{action.label}
								</Button>
							))}
						</div>
					)}

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
							{showDetails ? "Hide raw error" : "Show raw error"}
						</button>

						{showDetails && (
							<div className="mt-2 p-2 rounded bg-muted/50 text-xs font-mono overflow-auto max-h-32">
								<pre className="whitespace-pre-wrap break-all">{error}</pre>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
