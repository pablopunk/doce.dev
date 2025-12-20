import { useState, useRef, useEffect } from "react";
import { PlayIcon, PauseIcon, ChevronDownIcon, CircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { actions } from "astro:actions";

interface QueuePlayerControlProps {
	paused: boolean;
	concurrency: number;
	stats: {
		queued: number;
		running: number;
	};
	onToggleQueue: () => Promise<void>;
	onConcurrencyChange?: () => void;
}

export function QueuePlayerControl({
	paused,
	concurrency: initialConcurrency,
	stats,
	onToggleQueue,
	onConcurrencyChange,
}: QueuePlayerControlProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [localConcurrency, setLocalConcurrency] = useState(initialConcurrency);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Update local state when prop changes (from stream)
	useEffect(() => {
		setLocalConcurrency(initialConcurrency);
	}, [initialConcurrency]);

	const handleToggle = async () => {
		setIsLoading(true);
		try {
			await onToggleQueue();
		} finally {
			setIsLoading(false);
		}
	};

	const handleConcurrencyChange = (value: number) => {
		// Update UI immediately for responsiveness
		setLocalConcurrency(value);

		// Debounce the API call - wait 500ms after user stops changing
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		debounceTimerRef.current = setTimeout(async () => {
			try {
				await actions.queue.setConcurrency({ concurrency: value });
				onConcurrencyChange?.();
			} catch (err) {
				console.error("Failed to set concurrency:", err);
				// Revert to previous value on error
				setLocalConcurrency(initialConcurrency);
			}
		}, 500);
	};

	return (
		<div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
			{/* Concurrency Slider */}
			<div className="flex items-center gap-3 min-w-[300px]">
				<span className="text-sm font-medium whitespace-nowrap">
					Concurrency
				</span>
				<input
					type="range"
					min={1}
					max={20}
					value={localConcurrency}
					onChange={(e) =>
						handleConcurrencyChange(parseInt(e.target.value, 10))
					}
					disabled={isLoading}
					className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
				/>
				<span className="text-sm text-muted-foreground whitespace-nowrap">
					{localConcurrency} job{localConcurrency !== 1 ? "s" : ""} / 20
				</span>
			</div>

			{/* Status and Stats */}
			<div className="flex items-center justify-end gap-2 min-w-0">
				{/* Play/Pause Icon Button */}
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={handleToggle}
					disabled={isLoading}
					className="shrink-0"
					title={paused ? "Resume queue" : "Pause queue"}
				>
					{paused ? (
						<PlayIcon className="size-4" />
					) : (
						<PauseIcon className="size-4" />
					)}
				</Button>

				{/* Status Text */}
				<div className="flex items-center gap-2 min-w-0">
					<span className="text-sm font-medium shrink-0">
						{paused ? "Paused" : "Running"}
					</span>

					{/* Indicator Dot */}
					<CircleIcon
						className={cn(
							"size-2 shrink-0",
							paused
								? "text-muted-foreground"
								: "text-green-500 animate-pulse-dot",
						)}
						fill="currentColor"
					/>

					{/* Stats */}
					<span className="text-xs text-muted-foreground truncate">
						{stats.queued} queued, {stats.running} running
					</span>
				</div>
			</div>
		</div>
	);
}
