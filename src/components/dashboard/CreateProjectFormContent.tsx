import { Loader2, Paperclip, Sparkles } from "lucide-react";
import { ImagePreview } from "@/components/chat/ImagePreview";
import { Button } from "@/components/ui/button";
import {
	MAX_IMAGES_PER_MESSAGE,
	VALID_IMAGE_MIME_TYPES,
} from "@/types/message";
import { ModelSelector } from "./ModelSelector";

interface Model {
	id: string;
	name: string;
	provider: string;
	vendor: string;
	supportsImages?: boolean;
}

import type { ImagePart } from "@/types/message";

interface CreateProjectFormContentProps {
	prompt: string;
	selectedModel: string | undefined;
	models: Model[];
	selectedImages: ImagePart[];
	isDragging: boolean;
	isLoading: boolean;
	error: string;
	imageError: string | null;
	currentModelSupportsImages: boolean;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	fileInputRef: React.RefObject<HTMLInputElement | null>;
	onPromptChange: (value: string) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
	onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
	onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
	onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
	onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onFileButtonClick: () => void;
	onRemoveImage: (id: string) => void;
	onCreate: () => void;
	onModelChange: (compositeKey: string) => void;
}

export function CreateProjectFormContent({
	prompt,
	selectedModel,
	models,
	selectedImages,
	isDragging,
	isLoading,
	error,
	imageError,
	currentModelSupportsImages,
	textareaRef,
	fileInputRef,
	onPromptChange,
	onKeyDown,
	onPaste,
	onDragOver,
	onDragLeave,
	onDrop,
	onFileSelect,
	onFileButtonClick,
	onRemoveImage,
	onCreate,
	onModelChange,
}: CreateProjectFormContentProps) {
	return (
		<div className="w-full relative">
			<div className="flex flex-col gap-4">
				{/* biome-ignore lint/a11y/noStaticElementInteractions: This is a drop zone container */}
				<div
					className={`flex flex-col gap-3 p-4 rounded-2xl border bg-card transition-colors ${
						isDragging ? "border-primary bg-primary/5" : "border-input"
					}`}
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onDrop={onDrop}
				>
					<textarea
						ref={textareaRef}
						value={prompt}
						onChange={(e) => onPromptChange(e.target.value)}
						onKeyDown={onKeyDown}
						onPaste={onPaste}
						placeholder="It all starts here..."
						title="Use Ctrl+Enter (or Cmd+Enter on Mac) to create a project"
						className="flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground focus:outline-none"
						rows={1}
						style={{ minHeight: "80px" }}
						disabled={isLoading}
					/>
					{/* Image Preview */}
					{selectedImages.length > 0 && (
						<ImagePreview
							images={selectedImages}
							onRemove={onRemoveImage}
							disabled={isLoading}
						/>
					)}
					{/* Image Error */}
					{imageError && (
						<p className="text-sm text-destructive">{imageError}</p>
					)}
					<div className="flex items-center justify-between gap-3">
						<ModelSelector
							models={models}
							selectedModelId={selectedModel || ""}
							onModelChange={onModelChange}
						/>
						<div className="flex items-center gap-2">
							{/* Hidden File Input - only render when images are supported */}
							{currentModelSupportsImages && (
								<input
									ref={fileInputRef}
									type="file"
									accept={VALID_IMAGE_MIME_TYPES.join(",")}
									multiple
									onChange={onFileSelect}
									className="hidden"
								/>
							)}
							{/* Attachment Button - only show when images are supported */}
							{currentModelSupportsImages && (
								<Button
									variant="ghost"
									size="icon"
									onClick={onFileButtonClick}
									disabled={
										isLoading || selectedImages.length >= MAX_IMAGES_PER_MESSAGE
									}
									title={`Attach images (${selectedImages.length}/${MAX_IMAGES_PER_MESSAGE})`}
									type="button"
								>
									<Paperclip className="w-5 h-5" />
									{selectedImages.length > 0 && (
										<span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
											{selectedImages.length}
										</span>
									)}
								</Button>
							)}
							{/* Create Button */}
							<Button
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									onCreate();
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
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</div>
		</div>
	);
}
