import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SessionContextUsage } from "@/stores/useChatStore";

interface ChatContextUsageProps {
	usage: SessionContextUsage | null;
	isLoading?: boolean;
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
}: ChatContextUsageProps) {
	if (isLoading || !usage) return null;

	const percentage = usage.usage ?? 0;
	const circumference = 2 * Math.PI * 7;
	const progress = Math.max(0, Math.min(100, percentage));
	const dashOffset = circumference - (progress / 100) * circumference;
	const totalTokensLabel = formatCompactNumber(usage.total);
	const limitLabel = usage.limit ? formatCompactNumber(usage.limit) : null;

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
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
					</div>
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
				</div>
			</TooltipContent>
		</Tooltip>
	);
}
