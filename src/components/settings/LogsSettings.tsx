import { FileText, Server } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LogsSettingsProps {
	logFilePath: string;
}

interface LogChunkEvent {
	offset: number;
	nextOffset: number;
	text: string;
	truncated: boolean;
}

interface ParsedLogLine {
	text: string;
	level: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "unknown";
}

const PINO_META_KEYS = new Set([
	"level",
	"time",
	"msg",
	"pid",
	"hostname",
	"v",
]);

function formatTimestamp(time: string | number | undefined): string {
	if (time === undefined || time === null) return "";
	if (typeof time === "number") {
		try {
			return new Date(time).toISOString();
		} catch {
			return String(time);
		}
	}
	return String(time);
}

function formatContext(parsed: Record<string, unknown>): string {
	const entries = Object.entries(parsed).filter(
		([key]) => !PINO_META_KEYS.has(key),
	);
	if (entries.length === 0) return "";

	const parts = entries.map(([key, value]) => {
		if (key === "err" && value && typeof value === "object") {
			const err = value as { message?: string; stack?: string; type?: string };
			const label = err.type ?? "Error";
			const msg = err.message ?? "";
			const stack = err.stack ? `\n${err.stack}` : "";
			return `${key}=${label}: ${msg}${stack}`;
		}
		if (typeof value === "string") return `${key}=${value}`;
		if (typeof value === "number" || typeof value === "boolean")
			return `${key}=${value}`;
		try {
			return `${key}=${JSON.stringify(value)}`;
		} catch {
			return `${key}=[unserializable]`;
		}
	});
	return ` ${parts.join(" ")}`;
}

function parseLogLine(line: string): ParsedLogLine {
	try {
		const parsed = JSON.parse(line) as Record<string, unknown> & {
			level?: number;
			msg?: string;
			time?: string | number;
		};
		const level = mapPinoLevel(parsed.level);
		const timestamp = parsed.time ? `[${formatTimestamp(parsed.time)}] ` : "";
		const msg = parsed.msg ?? "";
		const context = formatContext(parsed);
		const text = `${timestamp}${msg}${context}`.trim();
		return { text: text || line, level };
	} catch {
		return {
			text: line,
			level: inferPlaintextLevel(line),
		};
	}
}

function mapPinoLevel(level?: number): ParsedLogLine["level"] {
	if (typeof level !== "number") return "unknown";
	if (level >= 60) return "fatal";
	if (level >= 50) return "error";
	if (level >= 40) return "warn";
	if (level >= 30) return "info";
	if (level >= 20) return "debug";
	return "trace";
}

function inferPlaintextLevel(line: string): ParsedLogLine["level"] {
	const normalized = line.toLowerCase();
	if (normalized.includes("fatal")) return "fatal";
	if (normalized.includes("error")) return "error";
	if (normalized.includes("warn")) return "warn";
	if (normalized.includes("debug")) return "debug";
	if (normalized.includes("trace")) return "trace";
	if (normalized.includes("info")) return "info";
	return "unknown";
}

function getLogLineClassName(level: ParsedLogLine["level"]): string {
	switch (level) {
		case "fatal":
		case "error":
			return "text-status-error";
		case "warn":
			return "text-status-warning";
		case "info":
			return "text-status-success";
		case "debug":
			return "text-sky-300";
		case "trace":
			return "text-violet-300";
		default:
			return "text-gray-100";
	}
}

export function LogsSettings({ logFilePath }: LogsSettingsProps) {
	const [logLines, setLogLines] = useState<ParsedLogLine[]>([]);
	const [logsTruncated, setLogsTruncated] = useState(false);
	const [logsConnected, setLogsConnected] = useState(false);
	const logsContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let eventSource: EventSource | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let isUnmounted = false;
		let nextOffset = 0;

		setLogLines([]);
		setLogsTruncated(false);
		setLogsConnected(false);

		const connect = () => {
			if (isUnmounted) return;

			const params = new URLSearchParams();
			if (nextOffset > 0) {
				params.set("offset", String(nextOffset));
			}

			const query = params.toString();
			eventSource = new EventSource(
				`/api/settings/host-logs${query ? `?${query}` : ""}`,
			);

			eventSource.addEventListener("open", () => {
				setLogsConnected(true);
			});

			eventSource.addEventListener("log.chunk", (event) => {
				const data = JSON.parse(event.data) as LogChunkEvent;
				nextOffset = data.nextOffset;
				setLogsTruncated(data.truncated);

				if (!data.text) {
					return;
				}

				setLogLines((prev) => {
					const nextLines = [
						...prev,
						...data.text
							.split("\n")
							.filter((line) => line.trim().length > 0)
							.map(parseLogLine),
					];
					const maxLines = 2000;
					return nextLines.length > maxLines
						? nextLines.slice(-maxLines)
						: nextLines;
				});

				requestAnimationFrame(() => {
					if (!logsContainerRef.current) return;
					logsContainerRef.current.scrollTop =
						logsContainerRef.current.scrollHeight;
				});
			});

			eventSource.addEventListener("error", () => {
				setLogsConnected(false);
				eventSource?.close();
				eventSource = null;
				if (!isUnmounted) {
					reconnectTimer = setTimeout(connect, 1000);
				}
			});
		};

		connect();

		return () => {
			isUnmounted = true;
			setLogsConnected(false);
			if (reconnectTimer) clearTimeout(reconnectTimer);
			eventSource?.close();
		};
	}, []);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Host logs</CardTitle>
					<CardDescription>
						Live Pino logs from the doce.dev server process.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-3 md:grid-cols-2">
						<div className="rounded-xl border border-border/60 p-4">
							<div className="flex items-center gap-2 text-sm font-medium">
								<Server className="size-4 text-muted-foreground" />
								Process
							</div>
							<p className="mt-2 text-sm text-muted-foreground">Host logger</p>
							<p className="text-sm text-muted-foreground break-all">
								{logFilePath}
							</p>
						</div>
						<div className="rounded-xl border border-border/60 p-4">
							<div className="flex items-center gap-2 text-sm font-medium">
								<FileText className="size-4 text-muted-foreground" />
								Stream
							</div>
							<p className="mt-2 text-sm text-muted-foreground">
								{logsConnected ? "Live" : "Reconnecting..."}
								{logsTruncated ? " • showing latest portion of the file" : ""}
							</p>
						</div>
					</div>

					<div
						ref={logsContainerRef}
						className="max-h-[640px] overflow-auto rounded-2xl border border-border/60 bg-black p-4 font-mono text-xs"
					>
						{logLines.length === 0 ? (
							<div className="text-gray-400">No host logs yet...</div>
						) : (
							<div className="space-y-1">
								{logLines.map((line, index) => (
									<div
										key={`${index}-${line.text}`}
										className={cn(
											"whitespace-pre-wrap break-all",
											getLogLineClassName(line.level),
										)}
									>
										{line.text}
									</div>
								))}
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
