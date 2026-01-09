import { Button } from "@/components/ui/button";
import { useCreateProject } from "@/hooks/useCreateProject";
import { useEffect } from "react";
import { CreateProjectFormContent } from "./CreateProjectFormContent";

interface CreateProjectFormProps {
	models: {
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
	}[];
	defaultModel?: string | undefined;
}

export function CreateProjectForm({
	models,
	defaultModel,
}: CreateProjectFormProps) {
	const {
		prompt,
		setPrompt,
		selectedModel,
		isLoading,
		error,
		selectedImages,
		imageError,
		isDragging,
		textareaRef,
		fileInputRef,
		handleFileSelect,
		handlePaste,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		removeImage,
		handleCreate,
		handleKeyDown,
		handleModelChange,
		handleGoToSettings,
		adjustTextareaHeight,
		currentModelSupportsImages,
		hasModels,
	} = useCreateProject({ models, defaultModel });

	useEffect(() => {
		adjustTextareaHeight();
	}, [adjustTextareaHeight]);

	if (!hasModels) {
		return (
			<div className="w-full relative">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-3 p-4 rounded-2xl border border-input bg-card">
						<p className="text-muted-foreground">
							No models available. Please configure a provider in Settings to
							get started.
						</p>
						<Button
							variant="outline"
							onClick={handleGoToSettings}
							type="button"
						>
							Go to Settings
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<CreateProjectFormContent
			prompt={prompt}
			selectedModel={selectedModel}
			models={models}
			selectedImages={selectedImages}
			isDragging={isDragging}
			isLoading={isLoading}
			error={error}
			imageError={imageError}
			currentModelSupportsImages={currentModelSupportsImages}
			textareaRef={textareaRef}
			fileInputRef={fileInputRef}
			onPromptChange={setPrompt}
			onKeyDown={handleKeyDown}
			onPaste={handlePaste}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onFileSelect={handleFileSelect}
			onFileButtonClick={() => fileInputRef.current?.click()}
			onRemoveImage={removeImage}
			onCreate={handleCreate}
			onModelChange={handleModelChange}
		/>
	);
}
