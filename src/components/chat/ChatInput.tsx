import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { ModelSelector } from "@/components/dashboard/ModelSelector";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  model?: string | null;
  models?: ReadonlyArray<{ id: string; name: string; provider: string }>;
  onModelChange?: (modelId: string) => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  model = null,
  models = [],
  onModelChange,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 200;
    textarea.style.height = Math.min(scrollHeight, maxHeight) + "px";
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setMessage("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key === "Enter" &&
      message.trim() &&
      !disabled
    ) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-input bg-card">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            title="Use Ctrl+Enter (or Cmd+Enter on Mac) to send a message"
            className="flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground focus:outline-none"
            rows={1}
            style={{ minHeight: "80px" }}
            disabled={disabled}
          />
          <div className="flex items-center justify-between gap-3">
            {models.length > 0 && onModelChange && (
              <ModelSelector
                models={models}
                selectedModelId={model || ""}
                onModelChange={onModelChange}
              />
            )}
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit(e);
              }}
              disabled={disabled || !message.trim()}
              title="Send message (or press Ctrl+Enter in textarea)"
              type="button"
              size="lg"
            >
              {disabled ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
