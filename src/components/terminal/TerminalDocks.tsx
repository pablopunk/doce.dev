import { ChevronDown, ChevronUp, Terminal, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogLine {
	text: string;
	type: "docker" | "app";
}

interface TerminalDocksProps {
	projectId: string;
	defaultOpen?: boolean;
}

export function TerminalDocks({
	projectId,
	defaultOpen = false,
}: TerminalDocksProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);
	const [dockerLines, setDockerLines] = useState<LogLine[]>([]);
	const [appLines, setAppLines] = useState<LogLine[]>([]);
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
				const { text, nextOffset: newOffset } = data;

				if (text) {
					const rawLines = text.split("\n").filter((l: string) => l.trim());
					const parsedLines = rawLines
						.map((line: string): LogLine | null => {
							let type: "docker" | "app" = "docker";
							let displayText = line;

							if (line.startsWith("[docker] ")) {
								type = "docker";
								displayText = line.replace("[docker] ", "");
							} else if (line.startsWith("[app] ")) {
								type = "app";
								displayText = line.replace("[app] ", "");
							}

							return { text: displayText, type };
						})
						.filter((line: LogLine | null): line is LogLine => line !== null);

					// Separate by type
					const dockerLogs = parsedLines.filter(
						(l: LogLine) => l.type === "docker",
					);
					const appLogs = parsedLines.filter((l: LogLine) => l.type === "app");

					if (dockerLogs.length > 0) {
						setDockerLines((prev) => [...prev, ...dockerLogs]);
					}
					if (appLogs.length > 0) {
						setAppLines((prev) => [...prev, ...appLogs]);
					}
					if (dockerLogs.length > 0 || appLogs.length > 0) {
						scrollToBottom();
					}

					setNextOffset(newOffset);
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
	}, [projectId, isOpen, nextOffset, scrollToBottom]);

	const handleClear = () => {
		setDockerLines([]);
		setAppLines([]);
	};

	const renderLogLines = (lines: LogLine[], keyPrefix: string) =>
		lines.map((line, i) => (
			<div
				key={`${keyPrefix}-${i}`}
				className="whitespace-pre-wrap break-all text-foreground"
			>
				{line.text}
			</div>
		));

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
				aria-label="Toggle terminal"
				className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-ring"
			>
				<div className="flex items-center gap-2 text-sm">
					<Terminal className="h-4 w-4" />
					<span>Terminal</span>
					{(dockerLines.length > 0 || appLines.length > 0) && (
						<span className="text-xs text-muted-foreground">
							({dockerLines.length + appLines.length} lines)
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
					{dockerLines.length === 0 && appLines.length === 0 ? (
						<div className="text-gray-500">Waiting for logs...</div>
					) : (
						<>
							{/* Docker Section */}
							<div className="text-xs font-semibold text-muted-foreground mb-2">
								Docker
							</div>
							{dockerLines.length === 0 ? (
								<div className="text-gray-500 mb-4">No docker logs yet...</div>
							) : (
								<div className="mb-4">
									{renderLogLines(dockerLines, "docker")}
								</div>
							)}

							{/* App Section */}
							<div className="text-xs font-semibold text-muted-foreground mb-2 pt-2 border-t border-muted">
								App
							</div>
							{appLines.length === 0 ? (
								<div className="text-gray-500">No app logs yet...</div>
							) : (
								renderLogLines(appLines, "app")
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
