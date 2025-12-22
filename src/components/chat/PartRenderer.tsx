import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { type MessagePart, type TextPart } from "@/types/message";
import "highlight.js/styles/atom-one-dark.css";

interface PartRendererProps {
  part: MessagePart;
  isStreaming?: boolean;
}

export function PartRenderer({ part, isStreaming }: PartRendererProps) {
  const streamingCursor = isStreaming ? (
    <span className="inline-block w-2 h-4 ml-0.5 bg-foreground animate-pulse" />
  ) : null;

  switch (part.type) {
    case "text": {
      const textPart = part as TextPart;
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-h1:my-3 prose-h2:my-2 prose-h3:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-pre:p-3 prose-pre:rounded prose-blockquote:border-l-2 prose-blockquote:border-muted prose-blockquote:pl-4 prose-blockquote:italic">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw, rehypeHighlight]}
          >
            {textPart.text}
          </ReactMarkdown>
          {streamingCursor}
        </div>
      );
    }

    case "reasoning": {
      const reasoningPart = part as any;
      return (
        <details className="cursor-pointer">
          <summary className="font-medium text-sm text-muted-foreground hover:text-foreground">
            💭 Thinking...
          </summary>
          <pre className="whitespace-pre-wrap font-mono text-xs mt-2 p-2 bg-muted rounded overflow-auto max-h-48">
            {reasoningPart.text}
          </pre>
        </details>
      );
    }

    case "error": {
      const errorPart = part as any;
      return (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
          <div className="font-semibold text-destructive">
            ⚠️ Error
          </div>
          <div className="text-destructive mt-1">
            {errorPart.message}
          </div>
          {errorPart.stack && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-destructive/70 hover:text-destructive">
                Stack trace
              </summary>
              <pre className="text-xs overflow-auto max-h-40 mt-2 p-2 bg-muted rounded font-mono">
                {errorPart.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    case "file": {
      const filePart = part as any;
      return (
        <div className="p-2 bg-muted rounded text-sm inline-flex items-center gap-2">
          <span>📄</span>
          <span className="font-mono">{filePart.path}</span>
          {filePart.size && (
            <span className="text-xs text-muted-foreground">
              ({(filePart.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>
      );
    }

    case "tool": {
      // Tool parts are handled separately by ToolCallDisplay
      // This is a fallback render
      const toolPart = part as any;
      return (
        <div className="p-2 bg-muted rounded text-sm">
          <strong>{toolPart.name}</strong>
          {toolPart.status && (
            <span className="ml-2 text-xs text-muted-foreground">
              [{toolPart.status}]
            </span>
          )}
        </div>
      );
    }

    default:
      return (
        <div className="text-sm text-muted-foreground">
          [Unknown part type]
        </div>
      );
  }
}
