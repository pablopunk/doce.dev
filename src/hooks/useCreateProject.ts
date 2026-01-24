import { actions } from "astro:actions";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	createImagePartFromFile,
	type ImagePart,
	MAX_IMAGES_PER_MESSAGE,
	VALID_IMAGE_MIME_TYPES,
	validateImageFile,
} from "@/types/message";

interface Model {
	id: string;
	name: string;
	provider: string;
	vendor: string;
	supportsImages?: boolean;
}

interface UseCreateProjectOptions {
	models: Model[];
	defaultModel?: string | undefined;
}

export function useCreateProject({
	models,
	defaultModel,
}: UseCreateProjectOptions) {
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
		textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
	};

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

	const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			// Filter only images
			const imageFiles = Array.from(files).filter((file) =>
				VALID_IMAGE_MIME_TYPES.includes(
					file.type as (typeof VALID_IMAGE_MIME_TYPES)[number],
				),
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
			} catch {
				// Action error, continue polling
			}

			// Wait before next attempt
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}

		// Timeout after ~20 seconds - project should definitely exist by now
	};

	const handleCreate = async () => {
		if (!prompt.trim()) return;

		setIsLoading(true);
		setError("");

		try {
			// Call action with JSON payload
			const result = await actions.projects.create({
				prompt: prompt.trim(),
				model: selectedModel ? buildFullModelId(selectedModel) : undefined,
				images:
					selectedImages.length > 0
						? JSON.stringify(
								selectedImages.map((img) => ({
									filename: img.filename,
									mime: img.mime,
									dataUrl: img.dataUrl,
								})),
							)
						: undefined,
			});

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

	const handleModelChange = async (compositeKey: string) => {
		// Parse composite key format: "provider:modelId"
		const [providerId, ...modelIdParts] = compositeKey.split(":");
		const modelId = modelIdParts.join(":"); // Handle modelIDs that might contain ':'

		const newModelConfig = models.find(
			(m) => m.id === modelId && m.provider === providerId,
		);
		const newModelSupportsImages = newModelConfig?.supportsImages ?? true;

		// Clear pending images if switching to a model that doesn't support them
		if (selectedImages.length > 0 && !newModelSupportsImages) {
			setSelectedImages([]);
			setImageError(null);
			toast.info("Images cleared", {
				description: "The selected model doesn't support image input",
			});
		}

		// Store composite key in state
		setSelectedModel(compositeKey);

		// Save as default model in DB
		try {
			// Send composite key format to backend
			await actions.settings.save({ defaultModel: compositeKey });
		} catch (_error) {
			// Silently fail - don't disrupt user experience
		}
	};

	const handleGoToSettings = () => {
		window.location.href = "/settings";
	};

	// Check if the current model supports images
	const currentModelSupportsImages = (() => {
		if (!selectedModel) return true;
		// Parse composite key if present
		const [providerId, ...modelIdParts] = selectedModel.split(":");
		const modelId = modelIdParts.join(":");
		return (
			models.find((m) => m.id === modelId && m.provider === providerId)
				?.supportsImages ?? true
		);
	})();

	// Check if any models are available
	const hasModels = models.length > 0;

	// Helper to build full model ID from composite key
	const buildFullModelId = (compositeKey: string) => {
		const [providerId, ...modelIdParts] = compositeKey.split(":");
		const modelId = modelIdParts.join(":");
		const modelWithProvider = models.find(
			(m) => m.id === modelId && m.provider === providerId,
		);
		if (modelWithProvider) {
			return `${modelWithProvider.provider}/${modelWithProvider.id}`;
		}
		return undefined;
	};

	return {
		// State
		prompt,
		setPrompt,
		selectedModel,
		isLoading,
		error,
		selectedImages,
		imageError,
		isDragging,

		// Refs
		textareaRef,
		fileInputRef,

		// Handlers
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

		// Computed values
		currentModelSupportsImages,
		hasModels,
	};
}
