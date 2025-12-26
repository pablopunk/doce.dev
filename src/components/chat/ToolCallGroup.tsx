import { ToolCallDisplay, type ToolCall } from "./ToolCallDisplay";

interface ToolCallGroupProps {
	toolCalls: ToolCall[];
	expandedTools: Set<string>;
	onToggle: (id: string) => void;
	onFileOpen?: ((filePath: string) => void) | undefined;
}

export function ToolCallGroup({
	toolCalls,
	expandedTools,
	onToggle,
	onFileOpen,
}: ToolCallGroupProps) {
	return (
		<div className="flex gap-3 p-4 bg-background">
			<div className="h-8 w-8 shrink-0" />
			<div className="flex-1 space-y-2 overflow-hidden">
				{toolCalls.map((toolCall) => (
					<ToolCallDisplay
						key={toolCall.id}
						toolCall={toolCall}
						isExpanded={expandedTools.has(toolCall.id)}
						onToggle={() => onToggle(toolCall.id)}
						onFileOpen={onFileOpen}
					/>
				))}
			</div>
		</div>
	);
}
