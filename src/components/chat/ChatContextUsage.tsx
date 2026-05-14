import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionContextUsage } from "@/stores/useChatStore";

interface ChatContextUsageProps {
	usage: SessionContextUsage | null;
	isLoading?: boolean;
	onCompact?: () => Promise<void> | void;
	compactDisabled?: boolean;
}

function formatCompactNumber(value: number) {
	return new Intl.NumberFormat("en", {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
}

export function ChatContextUsage({
	usage,
	isLoading = false,
	onCompact,
	compactDisabled = false,
}: ChatContextUsageProps) {
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [isCompacting, setIsCompacting] = useState(false);

	if (isLoading || !usage) return null;

	const percentage = usage.usage ?? 0;
	const circumference = 2 * Math.PI * 7;
	const progress = Math.max(0, Math.min(100, percentage));
	const dashOffset = circumference - (progress / 100) * circumference;
	const totalTokensLabel = formatCompactNumber(usage.total);
	const limitLabel = usage.limit ? formatCompactNumber(usage.limit) : null;
	const canCompact = Boolean(onCompact) && !compactDisabled && !isCompacting;

	const handleCompact = async () => {
		if (!onCompact) return;
		setIsCompacting(true);
		try {
			await onCompact();
			setConfirmOpen(false);
		} finally {
			setIsCompacting(false);
		}
	};

	const triggerContent = (
		<>
			<svg
				className="h-4 w-4 -rotate-90"
				viewBox="0 0 16 16"
				aria-hidden="true"
			>
				<circle
					cx="8"
					cy="8"
					r="7"
					fill="none"
					stroke="currentColor"
					strokeOpacity="0.2"
					strokeWidth="2"
				/>
				<circle
					cx="8"
					cy="8"
					r="7"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeDasharray={circumference}
					strokeDashoffset={dashOffset}
					strokeLinecap="round"
				/>
			</svg>
			<span>{percentage}%</span>
		</>
	);

	return (
		<>
			<Tooltip>
				<TooltipTrigger
					render={
						onCompact ? (
							<button
								type="button"
								onClick={() => setConfirmOpen(true)}
								disabled={!canCompact}
								className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
								aria-label="Compact conversation context"
							>
								{triggerContent}
							</button>
						) : (
							<div className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
								{triggerContent}
							</div>
						)
					}
				/>
				<TooltipContent side="bottom">
					<div className="flex items-center gap-2 text-xs text-background/80">
						<span className="font-medium text-background">
							{totalTokensLabel}
						</span>
						<span>tokens</span>
						{limitLabel && (
							<>
								<span>·</span>
								<span>{limitLabel} max</span>
							</>
						)}
						{onCompact && (
							<>
								<span>·</span>
								<span>click to compact</span>
							</>
						)}
					</div>
				</TooltipContent>
			</Tooltip>
			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Do you want to compact the conversation?
						</AlertDialogTitle>
						<AlertDialogDescription>
							OpenCode will summarize older context so the conversation can
							continue with more room in the model window.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isCompacting}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(event) => {
								event.preventDefault();
								void handleCompact();
							}}
							disabled={isCompacting || compactDisabled}
						>
							{isCompacting ? "Compacting..." : "Compact"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
