import { ChevronDown, ChevronUp, Terminal, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogLine {
	text: string;
	type: "docker" | "app";
	streamType: "out" | "err";
}

interface TerminalDockProps {
	projectId: string;
	logType: "docker" | "app";
	defaultOpen?: boolean;
}

export function TerminalDock({
	projectId,
	logType,
	defaultOpen = false,
}: TerminalDockProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const [lines, setLines] = useState<LogLine[]>([]);
	const [nextOffset, setNextOffset] = useState<number | null>(null);
	const terminalRef = useRef<HTMLDivElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);

	const scrollToBottom = useCallback(() => {
		if (terminalRef.current) {
			terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
		}
	}, []);

	// Connect to logs SSE
	useEffect(() => {
		if (!isOpen) return;

		const url =
			nextOffset !== null
				? `/api/projects/${projectId}/logs?offset=${nextOffset}`
				: `/api/projects/${projectId}/logs`;

		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;

		eventSource.addEventListener("log.chunk", (e) => {
			try {
				const data = JSON.parse(e.data);
				const { text, nextOffset: newOffset, truncated } = data;

				if (truncated && lines.length === 0) {
					// Show truncation indicator
					setLines([
						{
							text: "[...showing last portion of logs...]",
							type: logType,
							streamType: "out",
						},
					]);
				}

				if (text) {
					// Split text into lines and parse markers
					const rawLines = text.split("\n").filter((l: string) => l.trim());
					const newLines = rawLines
						.map((line: string): LogLine | null => {
							let type: "docker" | "app" = "docker";
							let streamType: "out" | "err" = "out";
							let displayText = line;

							if (line.startsWith("[docker-err]")) {
								type = "docker";
								streamType = "err";
								displayText = line.replace("[docker-err] ", "");
							} else if (line.startsWith("[docker-out]")) {
								type = "docker";
								streamType = "out";
								displayText = line.replace("[docker-out] ", "");
							} else if (line.startsWith("[app-err]")) {
								type = "app";
								streamType = "err";
								displayText = line.replace("[app-err] ", "");
							} else if (line.startsWith("[app-out]")) {
								type = "app";
								streamType = "out";
								displayText = line.replace("[app-out] ", "");
							}

							// Filter to only show logs matching this dock's type
							if (type !== logType) {
								return null;
							}

							return { text: displayText, type, streamType };
						})
						.filter((line: LogLine | null): line is LogLine => line !== null);

					setLines((prev) => [...prev, ...newLines]);
					setNextOffset(newOffset);
					scrollToBottom();
				}
			} catch {
				// Ignore parse errors
			}
		});

		eventSource.onerror = () => {
			// Will auto-reconnect
		};

		return () => {
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [projectId, isOpen, scrollToBottom, logType, lines.length, nextOffset]);

	// Scroll when lines change
	useEffect(() => {
		scrollToBottom();
	}, [scrollToBottom]);

	const handleClear = () => {
		setLines([]);
	};

	const title = logType === "docker" ? "Docker" : "App";

	return (
		<div
			className={cn(
				"border-t bg-background transition-all duration-200",
				isOpen ? "h-64" : "h-10",
			)}
		>
			{/* Header */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				aria-expanded={isOpen}
				aria-label={`Toggle ${title} terminal`}
				className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-ring"
			>
				<div className="flex items-center gap-2 text-sm">
					<Terminal className="h-4 w-4" />
					<span>{title}</span>
					{lines.length > 0 && (
						<span className="text-xs text-muted-foreground">
							({lines.length} lines)
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					{isOpen && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={(e) => {
								e.stopPropagation();
								handleClear();
							}}
						>
							<Trash2 className="h-3 w-3" />
						</Button>
					)}
					{isOpen ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronUp className="h-4 w-4" />
					)}
				</div>
			</button>

			{/* Content */}
			{isOpen && (
				<div
					ref={terminalRef}
					className="h-[calc(100%-40px)] overflow-y-auto p-4 font-mono text-xs bg-black"
				>
					{lines.length === 0 ? (
						<div className="text-gray-500">Waiting for logs...</div>
					) : (
						lines.map((line, i) => {
							const isError = line.streamType === "err";
							const colorClass = isError
								? "text-status-error"
								: "text-status-success";
							return (
								<div
									key={i}
									className={cn("whitespace-pre-wrap break-all", colorClass)}
								>
									{line.text}
								</div>
							);
						})
					)}
				</div>
			)}
		</div>
	);
}
