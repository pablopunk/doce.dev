import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Terminal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TerminalDockProps {
  projectId: string;
  defaultOpen?: boolean;
}

export function TerminalDock({ projectId, defaultOpen = false }: TerminalDockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [lines, setLines] = useState<string[]>([]);
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

    const url = nextOffset !== null
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
          setLines(["[...showing last portion of logs...]\n"]);
        }

        if (text) {
          // Split text into lines and append
          const newLines = text.split("\n").filter((l: string) => l.trim());
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
  }, [projectId, isOpen, scrollToBottom]);

  // Scroll when lines change
  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  const handleClear = () => {
    setLines([]);
  };

  return (
    <div
      className={cn(
        "border-t bg-background transition-all duration-200",
        isOpen ? "h-64" : "h-10"
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          <Terminal className="h-4 w-4" />
          <span>Terminal</span>
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
          className="h-[calc(100%-40px)] overflow-y-auto p-4 font-mono text-xs bg-black text-green-400"
        >
          {lines.length === 0 ? (
            <div className="text-gray-500">Waiting for logs...</div>
          ) : (
            lines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
