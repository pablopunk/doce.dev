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

  // Extract context from input for various tools
  const getToolContext = (): string | null => {
    if (!toolCall.input || typeof toolCall.input !== "object") return null;

    const input = toolCall.input as Record<string, unknown>;

    // File-related tools: show file path
    const fileRelatedTools = ["read", "write", "edit", "delete", "list"];
    if (fileRelatedTools.includes(toolCall.name)) {
      if (typeof input.filePath === "string") {
        return input.filePath.split("/").pop() || null;
      }
      if (typeof input.path === "string") {
        const path = input.path as string;
        return path.split("/").pop() || path;
      }
    }

    // Bash: show command (truncated if too long)
    if (toolCall.name === "bash") {
      if (typeof input.command === "string") {
        const command = input.command;
        const maxLength = 60;
        return command.length > maxLength 
          ? `${command.substring(0, maxLength)}...`
          : command;
      }
    }

    // Glob: show pattern
    if (toolCall.name === "glob") {
      if (typeof input.pattern === "string") {
        return input.pattern;
      }
    }
    
    return null;
  };

  const toolContext = getToolContext();

  const formatOutput = (value: unknown): string => {
    if (typeof value === "string") {
      return value;
    }
    return JSON.stringify(value, null, 2);
  };

  return (
    <div className="border rounded-md overflow-hidden text-sm">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 bg-muted/50 transition-colors text-left",
          "hover:bg-muted cursor-pointer"
        )}
      >
        <ToolIcon className={cn("h-3.5 w-3.5", isThinking ? "text-purple-500" : "text-muted-foreground")} />
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
