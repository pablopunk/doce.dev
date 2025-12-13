import { User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const content = message.content + (message.isStreaming ? "" : "");
  const streamingCursor = message.isStreaming ? (
    <span className="inline-block w-2 h-4 ml-0.5 bg-foreground animate-pulse" />
  ) : null;

  return (
    <div
      className={cn(
        "flex gap-3 p-4",
        isUser ? "bg-muted/50" : "bg-background"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="font-medium text-sm">
          {isUser ? "You" : "Assistant"}
        </div>
        <div className="markdown-content text-sm leading-relaxed">
          {isUser ? (
            <pre className="whitespace-pre-wrap font-sans text-sm overflow-auto">
              {content}
              {streamingCursor}
            </pre>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-h1:my-3 prose-h2:my-2 prose-h3:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground prose-pre:p-3 prose-pre:rounded prose-blockquote:border-l-2 prose-blockquote:border-muted prose-blockquote:pl-4 prose-blockquote:italic">
              <ReactMarkdown>{content}</ReactMarkdown>
              {streamingCursor}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
