"use client";

import Ansi from "ansi-to-react";
import { ChevronDown, ChevronUp, Copy, Terminal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TerminalDockProps {
	projectId: string;
	isPreviewRunning: boolean;
	isExpanded: boolean;
	onToggle: () => void;
	previewUrl?: string | null;
	onPreviewUrlDetected?: (url: string) => void;
}

export function TerminalDock({
	projectId,
	isPreviewRunning,
	isExpanded,
	onToggle,
	previewUrl,
	onPreviewUrlDetected,
}: TerminalDockProps) {
	const [logs, setLogs] = useState<string[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const [isCopied, setIsCopied] = useState(false);
	const terminalRef = useRef<HTMLDivElement>(null);
	const eventSourceRef = useRef<EventSource | null>(null);

	const rewriteLogLine = (line: string) => {
		let previewOrigin: string | null = null;
		let previewPort: string | null = null;
		let previewProtocol: string | null = null;

		if (previewUrl) {
			try {
				const url = new URL(previewUrl);
				previewOrigin = `${url.protocol}//${url.host}`;
				previewPort = url.port || null;
				previewProtocol = url.protocol;
			} catch {
				previewOrigin = null;
				previewPort = null;
				previewProtocol = null;
			}
		}

		const ipv4HostRegex = /^\d{1,3}(?:\.\d{1,3}){3}$/;

		return line.replace(
			/(https?:\/\/)([^:\s/]+)(?::(\d{2,5}))?([^\s]*)?/g,
			(match, protocol: string, host: string, _port?: string, path = "") => {
				const isLocalHost =
					host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
				const isIpv4 = ipv4HostRegex.test(host) && !isLocalHost;

				if (isLocalHost && previewOrigin) {
					const rewritten = `${previewOrigin}${path || ""}`;
					if (onPreviewUrlDetected) {
						onPreviewUrlDetected(rewritten);
					}
					return rewritten;
				}

				if (isIpv4) {
					const baseProtocol = previewProtocol ?? protocol;
					const portPart = previewPort ? `:${previewPort}` : "";
					const rewritten = `${baseProtocol}//127.0.0.1${portPart}${path || ""}`;
					if (onPreviewUrlDetected) {
						onPreviewUrlDetected(rewritten);
					}
					return rewritten;
				}

				return match as string;
			},
		);
	};

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

		// Clear logs on reconnect (component remount means restart happened)
		setLogs([]);

		// Connect to SSE endpoint
		const eventSource = new EventSource(`/api/projects/${projectId}/logs`);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			setIsConnected(true);
			setLogs((prev) => [...prev, "	Connected to container logs\n"]);
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
			eventSource.close();
		};

		return () => {
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [projectId, isPreviewRunning]);

	const handleClear = () => {
		setLogs([]);
	};

	const handleCopy = async () => {
		const logText = logs.join("");
		try {
			await navigator.clipboard.writeText(logText);
			setIsCopied(true);
			setTimeout(() => setIsCopied(false), 2000);
		} catch (error) {
			console.error("Failed to copy logs:", error);
		}
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
				"absolute bottom-0 left-0 right-0 z-10 bg-bg border-t border-border-border transition-all duration-300 ease-in-out",
				isExpanded ? "h-80" : "h-12",
			)}
		>
			{/* Header */}
			<div className="h-12 px-4 flex items-center justify-between border-b border-border-border bg-surface/30">
				<button
					onClick={handleToggle}
					className="flex items-center gap-2 hover:text-fg text-muted transition-colors flex-1"
				>
					<Terminal className="h-4 w-4" />
					<span className="text-sm font-medium">Terminal</span>
					{isConnected && (
						<span className="text-xs text-muted">({logs.length} lines)</span>
					)}
				</button>

				<div className="flex items-center gap-1">
					{isExpanded && logs.length > 0 && (
						<Button
							variant="ghost"
							size="icon"
							onClick={handleCopy}
							className="h-8 w-8"
							title={isCopied ? "Copied!" : "Copy logs"}
						>
							<Copy className={cn("h-4 w-4", isCopied && "text-warning")} />
						</Button>
					)}
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
					className="h-[calc(100%-3rem)] overflow-y-auto bg-black text-strong p-4 font-mono text-sm"
				>
					{logs.length === 0 ? (
						<div className="text-muted">
							{isConnected
								? "Waiting for logs..."
								: "Connecting to container..."}
						</div>
					) : (
						<pre className="whitespace-pre-wrap break-words">
							<Ansi>{logs.map(rewriteLogLine).join("")}</Ansi>
						</pre>
					)}
				</div>
			)}
		</div>
	);
}
