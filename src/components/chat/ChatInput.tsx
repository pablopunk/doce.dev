import {
	useState,
	useRef,
	useEffect,
	type KeyboardEvent,
	type FormEvent,
	type DragEvent,
	type ClipboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { ModelSelector } from "@/components/dashboard/ModelSelector";
import { ImagePreview } from "./ImagePreview";
import {
	type ImagePart,
	createImagePartFromFile,
	validateImageFile,
	MAX_IMAGES_PER_MESSAGE,
	VALID_IMAGE_MIME_TYPES,
} from "@/types/message";

interface ChatInputProps {
	onSend: (message: string, images?: ImagePart[]) => void;
	disabled?: boolean;
	placeholder?: string;
	model?: string | null;
	models?: ReadonlyArray<{ id: string; name: string; provider: string; supportsImages?: boolean }>;
	onModelChange?: (modelId: string) => void;
	// Image state lifted from parent
	images?: ImagePart[];
	onImagesChange?: (images: ImagePart[]) => void;
	imageError?: string | null;
	onImageError?: (error: string | null) => void;
	supportsImages?: boolean;
}

export function ChatInput({
	onSend,
	disabled = false,
	placeholder = "Type a message...",
	model = null,
	models = [],
	onModelChange,
	images: externalImages,
	onImagesChange,
	imageError: externalImageError,
	onImageError,
	supportsImages = true,
}: ChatInputProps) {
	const [message, setMessage] = useState("");
	// Internal state (used when external state is not provided)
	const [internalImages, setInternalImages] = useState<ImagePart[]>([]);
	const [internalImageError, setInternalImageError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Use external state if provided, otherwise use internal state
	const selectedImages = externalImages ?? internalImages;
	const imageError = externalImageError ?? internalImageError;

	// Wrapper to handle both external and internal state updates
	const updateImages = (updater: ImagePart[] | ((prev: ImagePart[]) => ImagePart[])) => {
		const newImages = typeof updater === "function" ? updater(selectedImages) : updater;
		if (onImagesChange) {
			onImagesChange(newImages);
		} else {
			setInternalImages(newImages);
		}
	};

	const updateImageError = (error: string | null) => {
		if (onImageError) {
			onImageError(error);
		} else {
			setInternalImageError(error);
		}
	};

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

	// Process files and add as image attachments
	const processFiles = async (files: FileList | File[]) => {
		// Don't process if images aren't supported
		if (!supportsImages) return;

		updateImageError(null);
		const fileArray = Array.from(files);

		// Check total count
		const totalCount = selectedImages.length + fileArray.length;
		if (totalCount > MAX_IMAGES_PER_MESSAGE) {
			updateImageError(`Max ${MAX_IMAGES_PER_MESSAGE} images allowed`);
			return;
		}

		// Validate and process each file
		const newImages: ImagePart[] = [];
		for (const file of fileArray) {
			const validation = validateImageFile(file);
			if (!validation.valid) {
				updateImageError(validation.error || "Invalid file");
				return;
			}

			try {
				const imagePart = await createImagePartFromFile(file);
				newImages.push(imagePart);
			} catch {
				updateImageError(`Failed to read ${file.name}`);
				return;
			}
		}

		updateImages((prev) => [...prev, ...newImages]);
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			processFiles(e.target.files);
		}
		// Reset input so same file can be selected again
		e.target.value = "";
	};

	const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
		// Don't process image pastes if images aren't supported
		if (!supportsImages) return;

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
		// Don't show drag state if images aren't supported
		if (!supportsImages) return;

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

		// Show error if images aren't supported
		if (!supportsImages) {
			const imageFiles = e.dataTransfer?.files ? 
				Array.from(e.dataTransfer.files).filter((file) =>
					file.type.startsWith("image/")
				) : [];
			
			if (imageFiles && imageFiles.length > 0) {
				toast.error("Images not supported", {
					description: "The selected model doesn't support image input",
				});
			}
			return;
		}

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			// Filter only images
			const imageFiles = Array.from(files).filter((file) =>
				VALID_IMAGE_MIME_TYPES.includes(file.type as typeof VALID_IMAGE_MIME_TYPES[number])
			);
			if (imageFiles.length > 0) {
				processFiles(imageFiles);
			}
		}
	};

	const removeImage = (id: string) => {
		updateImages((prev) => prev.filter((img) => img.id !== id));
		updateImageError(null);
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		const trimmed = message.trim();
		const hasContent = trimmed || selectedImages.length > 0;
		if (!hasContent || disabled) return;

		onSend(trimmed, selectedImages.length > 0 ? selectedImages : undefined);
		setMessage("");
		updateImages([]);
		updateImageError(null);

		// Reset textarea height
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		const hasContent = message.trim() || selectedImages.length > 0;
		if (
			(e.ctrlKey || e.metaKey) &&
			e.key === "Enter" &&
			hasContent &&
			!disabled
		) {
			e.preventDefault();
			handleSubmit(e);
		}
	};

	const hasContent = message.trim() || selectedImages.length > 0;

	return (
		<div className="w-full p-4">
			<div className="flex flex-col gap-4">
				<div
					className={`flex flex-col gap-3 p-4 rounded-2xl border bg-card transition-colors ${
						isDragging && supportsImages ? "border-primary bg-primary/5" : "border-input"
					}`}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
				>
					<textarea
						ref={textareaRef}
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						onKeyDown={handleKeyDown}
						onPaste={handlePaste}
						placeholder={placeholder}
						title="Use Ctrl+Enter (or Cmd+Enter on Mac) to send a message"
						className="flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground focus:outline-none"
						rows={1}
						style={{ minHeight: "80px" }}
						disabled={disabled}
					/>
					{/* Image Preview */}
					{selectedImages.length > 0 && (
						<ImagePreview
							images={selectedImages}
							onRemove={removeImage}
							disabled={disabled}
						/>
					)}
					{/* Error Message */}
					{imageError && (
						<p className="text-sm text-destructive">{imageError}</p>
					)}
					<div className="flex items-center justify-between gap-3">
						{models.length > 0 && onModelChange && (
							<ModelSelector
								models={models}
								selectedModelId={model || ""}
								onModelChange={onModelChange}
							/>
						)}
						<div className="flex items-center gap-2">
							{/* Hidden File Input - only render when images are supported */}
							{supportsImages && (
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
							{supportsImages && (
								<Button
									variant="ghost"
									size="icon"
									onClick={() => fileInputRef.current?.click()}
									disabled={disabled || selectedImages.length >= MAX_IMAGES_PER_MESSAGE}
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
							{/* Send Button */}
							<Button
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									handleSubmit(e);
								}}
								disabled={disabled || !hasContent}
								title="Send message (or press Ctrl+Enter in textarea)"
								type="button"
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
		</div>
	);
}
