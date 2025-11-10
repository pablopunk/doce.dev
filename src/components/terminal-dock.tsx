"use client";

import { ChevronDown, ChevronUp, Terminal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TerminalDockProps {
	projectId: string;
	isPreviewRunning: boolean;
	isExpanded: boolean;
	onToggle: () => void;
}

export function TerminalDock({
	projectId,
	isPreviewRunning,
	isExpanded,
	onToggle,
}: TerminalDockProps) {
	const [logs, setLogs] = useState<string[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const terminalRef = useRef<HTMLDivElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);

	// Auto-scroll to bottom when new logs arrive
	useEffect(() => {
		if (terminalRef.current && isExpanded) {
			terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
		}
	}, [logs, isExpanded]);

	// Connect to log stream when preview is running
	useEffect(() => {
		if (!isPreviewRunning) {
			// Close existing connection
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
			setIsConnected(false);
			setLogs([]);
			return;
		}

		// Only connect when expanded to save resources
		if (!isExpanded) {
			return;
		}

		// Connect to SSE endpoint
		const eventSource = new EventSource(`/api/projects/${projectId}/logs`);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			setIsConnected(true);
		};

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.log) {
					setLogs((prev) => {
						const newLogs = [...prev, data.log];
						// Keep last 1000 lines to prevent memory issues
						return newLogs.slice(-1000);
					});
				}
			} catch (error) {
				console.error("Failed to parse log message:", error);
			}
		};

		eventSource.onerror = (error) => {
			console.error("EventSource error:", error);
			setIsConnected(false);
			setLogs((prev) => [...prev, "✗ Connection lost\n"]);
			eventSource.close();
		};

		return () => {
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [projectId, isPreviewRunning, isExpanded]);

	const handleClear = () => {
		setLogs([]);
	};

	const handleToggle = () => {
		onToggle();
	};

	if (!isPreviewRunning) {
		return null;
	}

	return (
		<div
			className={cn(
				"absolute bottom-0 left-0 right-0 z-10 bg-background border-t border-border-default transition-all duration-300 ease-in-out",
				isExpanded ? "h-80" : "h-12",
			)}
		>
			{/* Header */}
			<div className="h-12 px-4 flex items-center justify-between border-b border-border-default bg-muted/30">
				<button
					onClick={handleToggle}
					className="flex items-center gap-2 hover:text-foreground text-foreground-tertiary transition-colors flex-1"
				>
					<Terminal className="h-4 w-4" />
					<span className="text-sm font-medium">Terminal</span>
					{isConnected && (
						<span className="text-xs text-foreground-tertiary">
							({logs.length} lines)
						</span>
					)}
				</button>

				<div className="flex items-center gap-1">
					{isExpanded && (
						<Button
							variant="ghost"
							size="icon"
							onClick={handleClear}
							className="h-8 w-8"
							title="Clear logs"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon"
						onClick={handleToggle}
						className="h-8 w-8"
					>
						{isExpanded ? (
							<ChevronDown className="h-4 w-4" />
						) : (
							<ChevronUp className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>

			{/* Terminal content */}
			{isExpanded && (
				<div
					ref={terminalRef}
					className="h-[calc(100%-3rem)] overflow-y-auto bg-black text-green-400 p-4 font-mono text-sm"
				>
					{logs.length === 0 ? (
						<div className="text-foreground-tertiary">
							{isConnected
								? "Waiting for logs..."
								: "Connecting to container..."}
						</div>
					) : (
						<pre className="whitespace-pre-wrap break-words">
							{logs.join("")}
						</pre>
					)}
				</div>
			)}
		</div>
	);
}
