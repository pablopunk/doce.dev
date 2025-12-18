import { useState } from "react";
import { PlayIcon, PauseIcon, ChevronDownIcon, CircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface QueuePlayerControlProps {
  paused: boolean;
  stats: {
    queued: number;
    running: number;
  };
  onToggleQueue: () => Promise<void>;
}

export function QueuePlayerControl({
  paused,
  stats,
  onToggleQueue,
}: QueuePlayerControlProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      await onToggleQueue();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
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
              : "text-green-500 animate-pulse-dot"
          )}
          fill="currentColor"
        />

        {/* Stats */}
        <span className="text-xs text-muted-foreground truncate">
          {stats.queued} queued, {stats.running} running
        </span>
      </div>

      {/* Dropdown Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            title="Queue options"
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {paused ? (
            <DropdownMenuItem onClick={handleToggle} disabled={isLoading}>
              <PlayIcon className="size-3.5 mr-2" />
              Resume
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleToggle} disabled={isLoading}>
              <PauseIcon className="size-3.5 mr-2" />
              Pause
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
