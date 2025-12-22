import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { ModelSelector } from "./ModelSelector";
import { actions } from "astro:actions";

interface CreateProjectFormProps {
	models: readonly { id: string; name: string; provider: string }[];
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

	const handleCreate = async () => {
		if (!prompt.trim()) return;

		setIsLoading(true);
		setError("");

		try {
			// Create FormData for the form-based action
			const formData = new FormData();
			formData.append("prompt", prompt.trim());
			formData.append("model", selectedModel);

			const result = await actions.projects.create(formData);

			if (result.error) {
				setError(result.error.message);
				setIsLoading(false);
				return;
			}

			if (!result.data?.projectId) {
				setError("Failed to create project");
				setIsLoading(false);
				return;
			}

			const projectId = result.data.projectId;
			const url = `/projects/${projectId}`;

			// Poll for project to exist in DB
			await waitForProjectToExist(projectId);

			// Redirect to project page
			window.location.replace(url);
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "Failed to create project";
			setError(errorMessage);
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (
			(e.ctrlKey || e.metaKey) &&
			e.key === "Enter" &&
			prompt.trim() &&
			!isLoading
		) {
			e.preventDefault();
			handleCreate();
		}
	};

	const waitForProjectToExist = async (
		projectId: string,
		maxAttempts = 100,
	) => {
		const delayMs = 200; // Poll every 200ms

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			try {
				const result = await actions.projects.get({ projectId });
				if (result.data?.project) {
					// Project exists! We can redirect now
					return;
				}
			} catch (err) {
				// Action error, continue polling
			}

			// Wait before next attempt
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		// Timeout after ~20 seconds - project should definitely exist by now
	};

	return (
		<div className="w-full">
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-3 p-4 rounded-2xl border border-input bg-card">
					<textarea
						ref={textareaRef}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="It all starts here..."
						title="Use Ctrl+Enter (or Cmd+Enter on Mac) to create a project"
						className="flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground focus:outline-none"
						rows={1}
						style={{ minHeight: "80px" }}
						disabled={isLoading}
					/>
					<div className="flex items-center justify-between gap-3">
						<ModelSelector
							models={models}
							selectedModelId={selectedModel}
							onModelChange={setSelectedModel}
						/>
						<Button
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								handleCreate();
							}}
							disabled={isLoading || !prompt.trim()}
							title="Create project (or press Ctrl+Enter in textarea)"
							type="button"
						>
							{isLoading ? (
								<Loader2 className="w-5 h-5 animate-spin" />
							) : (
								<Sparkles className="w-5 h-5 text-chart-1" />
							)}
							<span className="bg-gradient-to-r from-chart-1 via-chart-4 to-chart-5 bg-clip-text text-transparent font-semibold">
								Create
							</span>
						</Button>
					</div>
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</div>
		</div>
	);
}
