import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToolInfo } from "./tools/registry";

export interface ToolCall {
	id: string;
	name: string;
	input?: unknown;
	output?: unknown;
	error?: unknown;
	status: "running" | "success" | "error";
}

interface ToolCallDisplayProps {
	toolCall: ToolCall;
	isExpanded?: boolean;
	onToggle?: () => void;
	onFileOpen?: ((filePath: string) => void) | undefined;
}

export function ToolCallDisplay({
	toolCall,
	isExpanded = false,
	onToggle,
	onFileOpen,
}: ToolCallDisplayProps) {
	// Get tool metadata from registry
	const toolInfo = getToolInfo(toolCall.name);
	const ToolIcon = toolInfo.icon;
	const displayName = toolInfo.name;

	// Get context string (e.g., file path, command) from input
	const toolContext = toolInfo.getContext?.(toolCall.input) ?? null;

	// Handle click - either open file or toggle expand
	const handleClick = () => {
		// For file tools, open in Files tab instead of expanding
		if (toolInfo.openFileOnClick && onFileOpen) {
			const filePath = toolInfo.getFilePath?.(toolCall.input);
			if (filePath) {
				onFileOpen(filePath);
				return;
			}
		}
		// Default: toggle expand
		onToggle?.();
	};

	const statusIcon = {
		running: <Loader2 className="h-3 w-3 animate-spin" />,
		success: <Check className="h-3 w-3" />,
		error: <X className="h-3 w-3" />,
	}[toolCall.status];

	const statusColor = {
		running: "text-yellow-500",
		success: "text-green-500",
		error: "text-red-500",
	}[toolCall.status];

	const formatOutput = (value: unknown): string => {
		if (typeof value === "string") {
			return value;
		}
		return JSON.stringify(value, null, 2);
	};

	const isThinking =
		toolCall.name === "thinking" || toolCall.name.includes("thinking");

	return (
		<div className="border rounded-md overflow-hidden text-sm">
			<button
				type="button"
				onClick={handleClick}
				className={cn(
					"w-full flex items-center gap-2 px-3 py-2 bg-muted/50 transition-colors text-left",
					"hover:bg-muted cursor-pointer",
				)}
			>
				<ToolIcon
					className={cn(
						"h-3.5 w-3.5",
						toolInfo.iconClass ?? "text-muted-foreground",
					)}
				/>
				<span className="flex-1 font-mono text-xs">
					{displayName}
					{toolContext && (
						<span className="ml-2 text-muted-foreground text-xs font-normal">
							{toolContext}
						</span>
					)}
				</span>
				<span className={cn("flex items-center gap-1", statusColor)}>
					{statusIcon}
				</span>
			</button>

			{isExpanded && (
				<div className="p-3 space-y-2 text-xs">
					{isThinking &&
					toolCall.output !== undefined &&
					toolCall.output !== null ? (
						<pre className="bg-muted p-2 rounded overflow-x-auto max-h-64 whitespace-pre-wrap">
							{formatOutput(toolCall.output)}
						</pre>
					) : (
						<>
							{toolCall.input !== undefined && toolCall.input !== null && (
								<div>
									<div className="font-medium text-muted-foreground mb-1">
										Input:
									</div>
									<pre className="bg-muted p-2 rounded overflow-x-auto max-h-32">
										{formatOutput(toolCall.input)}
									</pre>
								</div>
							)}
							{toolCall.output !== undefined && toolCall.output !== null && (
								<div>
									<div className="font-medium text-muted-foreground mb-1">
										Output:
									</div>
									<pre className="bg-muted p-2 rounded overflow-x-auto max-h-32">
										{formatOutput(toolCall.output).slice(0, 500)}
									</pre>
								</div>
							)}
							{toolCall.error !== undefined && (
								<div>
									<div className="font-medium text-red-500 mb-1">Error:</div>
									<pre className="bg-red-50 dark:bg-red-950/20 p-2 rounded overflow-x-auto max-h-32 text-red-600">
										{formatOutput(toolCall.error)}
									</pre>
								</div>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
