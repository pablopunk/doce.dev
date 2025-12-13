import { Wrench, Check, X, Loader2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export function ToolCallDisplay({
  toolCall,
  isExpanded = false,
  onToggle,
}: ToolCallDisplayProps) {
  const isThinking = toolCall.name === "thinking";
  
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

  const ToolIcon = isThinking ? Brain : Wrench;
  const displayName = isThinking ? "Thinking..." : toolCall.name;

  const formatOutput = (value: unknown): string => {
    if (typeof value === "string") {
      return value;
    }
    return JSON.stringify(value, null, 2);
  };

  return (
    <div className="border rounded-md overflow-hidden text-sm">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 bg-muted/50 transition-colors text-left",
          "hover:bg-muted cursor-pointer"
        )}
      >
        <ToolIcon className={cn("h-3.5 w-3.5", isThinking ? "text-purple-500" : "text-muted-foreground")} />
        <span className="flex-1 font-mono text-xs">{displayName}</span>
        <span className={cn("flex items-center gap-1", statusColor)}>
          {statusIcon}
        </span>
      </button>

      {isExpanded && (
        <div className="p-3 space-y-2 text-xs">
          {isThinking && toolCall.output !== undefined && toolCall.output !== null && (
            <pre className="bg-muted p-2 rounded overflow-x-auto max-h-64 whitespace-pre-wrap">
              {formatOutput(toolCall.output)}
            </pre>
          )}
          {!isThinking && (
            <>
              {toolCall.input !== undefined && toolCall.input !== null && (
                <div>
                  <div className="font-medium text-muted-foreground mb-1">Input:</div>
                  <pre className="bg-muted p-2 rounded overflow-x-auto max-h-32">
                    {formatOutput(toolCall.input)}
                  </pre>
                </div>
              )}
              {toolCall.output !== undefined && toolCall.output !== null && (
                <div>
                  <div className="font-medium text-muted-foreground mb-1">Output:</div>
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
