import { useState, useRef, useEffect, type DragEvent, type ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Paperclip } from "lucide-react";
import { ModelSelector } from "./ModelSelector";
import { DockerBlockingOverlay } from "./DockerBlockingOverlay";
import { actions } from "astro:actions";
import { toast } from "sonner";
import { useDocker } from "@/components/providers/DockerHealthProvider";
import { ImagePreview } from "@/components/chat/ImagePreview";
import {
	type ImagePart,
	createImagePartFromFile,
	validateImageFile,
	MAX_IMAGES_PER_MESSAGE,
	VALID_IMAGE_MIME_TYPES,
} from "@/types/message";

interface CreateProjectFormProps {
	models: readonly { id: string; name: string; provider: string; supportsImages?: boolean }[];
	defaultModel: string;
}

export function CreateProjectForm({
	models,
	defaultModel,
}: CreateProjectFormProps) {
	const { dockerAvailable } = useDocker();
	const [prompt, setPrompt] = useState("");
	const [selectedModel, setSelectedModel] = useState(defaultModel);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [selectedImages, setSelectedImages] = useState<ImagePart[]>([]);
	const [imageError, setImageError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

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

	// Process files and add as image attachments
	const processFiles = async (files: FileList | File[]) => {
		setImageError(null);
		const fileArray = Array.from(files);

		// Check total count
		const totalCount = selectedImages.length + fileArray.length;
		if (totalCount > MAX_IMAGES_PER_MESSAGE) {
			setImageError(`Max ${MAX_IMAGES_PER_MESSAGE} images allowed`);
			return;
		}

		// Validate and process each file
		const newImages: ImagePart[] = [];
		for (const file of fileArray) {
			const validation = validateImageFile(file);
			if (!validation.valid) {
				setImageError(validation.error || "Invalid file");
				return;
			}

			try {
				const imagePart = await createImagePartFromFile(file);
				newImages.push(imagePart);
			} catch {
				setImageError(`Failed to read ${file.name}`);
				return;
			}
		}

		setSelectedImages((prev) => [...prev, ...newImages]);
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			processFiles(e.target.files);
		}
		// Reset input so same file can be selected again
		e.target.value = "";
	};

	const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
		const items = e.clipboardData?.items;
		if (!items) return;

		const imageFiles: File[] = [];
		for (const item of items) {
			if (item.type.startsWith("image/")) {
				const file = item.getAsFile();
				if (file) imageFiles.push(file);
			}
		}

		if (imageFiles.length > 0) {
			e.preventDefault();
			processFiles(imageFiles);
		}
	};

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			// Filter only images
			const imageFiles = Array.from(files).filter((file) =>
				VALID_IMAGE_MIME_TYPES.includes(file.type as typeof VALID_IMAGE_MIME_TYPES[number])
			);
			if (imageFiles.length > 0) {
				// Show error if images aren't supported
				if (!currentModelSupportsImages) {
					toast.error("Images not supported", {
						description: "The selected model doesn't support image input",
					});
					return;
				}
				processFiles(imageFiles);
			}
		}
	};

	const removeImage = (id: string) => {
		setSelectedImages((prev) => prev.filter((img) => img.id !== id));
		setImageError(null);
	};

	const handleCreate = async () => {
		if (!prompt.trim()) return;

		setIsLoading(true);
		setError("");

		try {
			// Create FormData for the form-based action
			const formData = new FormData();
			formData.append("prompt", prompt.trim());
			formData.append("model", selectedModel);

			// Add images as base64 JSON array
			if (selectedImages.length > 0) {
				const imagesData = selectedImages.map((img) => ({
					filename: img.filename,
					mime: img.mime,
					dataUrl: img.dataUrl,
				}));
				formData.append("images", JSON.stringify(imagesData));
			}

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

	const handleModelChange = (newModelId: string) => {
		const newModelConfig = models.find(m => m.id === newModelId);
		const newModelSupportsImages = newModelConfig?.supportsImages ?? true;

		// Clear pending images if switching to a model that doesn't support them
		if (selectedImages.length > 0 && !newModelSupportsImages) {
			setSelectedImages([]);
			setImageError(null);
			toast.info("Images cleared", {
				description: "The selected model doesn't support image input",
			});
		}

		setSelectedModel(newModelId);
	};

	// Check if the current model supports images
	const currentModelSupportsImages = models.find(m => m.id === selectedModel)?.supportsImages ?? true;

	return (
		<div className="w-full relative">
			{!dockerAvailable && <DockerBlockingOverlay />}
			<div className="flex flex-col gap-4">
				<div
					className={`flex flex-col gap-3 p-4 rounded-2xl border bg-card transition-colors ${
						isDragging ? "border-primary bg-primary/5" : "border-input"
					}`}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
				>
					<textarea
						ref={textareaRef}
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						onKeyDown={handleKeyDown}
						onPaste={handlePaste}
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
							onRemove={removeImage}
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
							selectedModelId={selectedModel}
							onModelChange={handleModelChange}
						/>
						<div className="flex items-center gap-2">
							{/* Hidden File Input - only render when images are supported */}
							{currentModelSupportsImages && (
								<input
									ref={fileInputRef}
									type="file"
									accept={VALID_IMAGE_MIME_TYPES.join(",")}
									multiple
									onChange={handleFileSelect}
									className="hidden"
								/>
							)}
							{/* Attachment Button - only show when images are supported */}
							{currentModelSupportsImages && (
								<Button
									variant="ghost"
									size="icon"
									onClick={() => fileInputRef.current?.click()}
									disabled={isLoading || selectedImages.length >= MAX_IMAGES_PER_MESSAGE}
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
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</div>
		</div>
	);
}
