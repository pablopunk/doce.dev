import { User, Bot } from "lucide-react";
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
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm">
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-2 h-4 ml-0.5 bg-foreground animate-pulse" />
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}
