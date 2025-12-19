import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { ModelSelector } from "./ModelSelector";
import { actions } from "astro:actions";

interface CreateProjectFormProps {
  models: Array<{ id: string; name: string; provider: string }>;
  defaultModel: string;
}

export function CreateProjectForm({
  models,
  defaultModel,
}: CreateProjectFormProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
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
  }, [prompt]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("prompt", prompt.trim());
    formData.append("model", selectedModel);

    try {
      const result = await actions.projects.create(formData);

      if (result.error) {
        setError(result.error.message);
        setIsLoading(false);
      }
      // On success, Astro redirects (no cleanup needed)
    } catch (err) {
      setError("Failed to create project");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-input bg-slate-950/50 dark:bg-slate-900/50">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask doce to build..."
            className="flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground focus:outline-none"
            rows={1}
            style={{ minHeight: "80px" }}
          />
          <div className="flex items-center justify-between gap-3">
            <ModelSelector
              models={models}
              selectedModelId={selectedModel}
              onModelChange={setSelectedModel}
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </form>
  );
}
