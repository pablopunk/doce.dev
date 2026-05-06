import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useCreateProject } from "@/hooks/useCreateProject";
import { CreateProjectFormContent } from "./CreateProjectFormContent";

interface CreateProjectFormProps {
	models: {
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
		supportsAttachments?: boolean;
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
		selectedAttachments,
		attachmentError,
		isDragging,
		textareaRef,
		fileInputRef,
		handleFileSelect,
		handlePaste,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		removeAttachment,
		handleCreate,
		handleKeyDown,
		handleModelChange,
		handleGoToSettings,
		adjustTextareaHeight,
		currentModelSupportsAttachments,
		hasModels,
		attachmentAccept,
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
			selectedAttachments={selectedAttachments}
			isDragging={isDragging}
			isLoading={isLoading}
			error={error}
			attachmentError={attachmentError}
			currentModelSupportsAttachments={currentModelSupportsAttachments}
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
			onRemoveAttachment={removeAttachment}
			onCreate={handleCreate}
			onModelChange={handleModelChange}
			attachmentAccept={attachmentAccept}
		/>
	);
}
