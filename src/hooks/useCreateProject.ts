import { actions } from "astro:actions";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { waitForEventSource } from "@/hooks/useEventSource";
import {
	CHAT_ATTACHMENT_ACCEPT,
	createPromptAttachmentFromFile,
	isImageAttachmentFile,
	isTextAttachmentFile,
	MAX_ATTACHMENTS_PER_MESSAGE,
	type PromptAttachmentPart,
	validateImageFile,
	validateTextAttachmentFile,
} from "@/types/message";

interface Model {
	id: string;
	name: string;
	provider: string;
	vendor: string;
	supportsImages?: boolean;
	supportsAttachments?: boolean;
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
	const [selectedAttachments, setSelectedAttachments] = useState<
		PromptAttachmentPart[]
	>([]);
	const [attachmentError, setAttachmentError] = useState<string | null>(null);
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

	const processFiles = async (files: FileList | File[]) => {
		setAttachmentError(null);
		const fileArray = Array.from(files);

		const totalCount = selectedAttachments.length + fileArray.length;
		if (totalCount > MAX_ATTACHMENTS_PER_MESSAGE) {
			setAttachmentError(
				`Max ${MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed`,
			);
			return;
		}

		const newAttachments: PromptAttachmentPart[] = [];
		for (const file of fileArray) {
			const isImage = isImageAttachmentFile(file);
			if (isImage && !currentModelSupportsAttachments) {
				setAttachmentError("Images not supported by the selected model");
				return;
			}
			const validation = isImage
				? validateImageFile(file)
				: validateTextAttachmentFile(file);
			if (!validation.valid) {
				setAttachmentError(validation.error || "Invalid file");
				return;
			}

			try {
				newAttachments.push(await createPromptAttachmentFromFile(file));
			} catch {
				setAttachmentError(`Failed to read ${file.name}`);
				return;
			}
		}

		setSelectedAttachments((prev) => [...prev, ...newAttachments]);
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
			const file = item.getAsFile();
			if (file && isImageAttachmentFile(file)) {
				imageFiles.push(file);
			}
		}

		if (imageFiles.length > 0) {
			e.preventDefault();
			void processFiles(imageFiles);
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
			const supportedFiles = Array.from(files).filter(
				(file) => isImageAttachmentFile(file) || isTextAttachmentFile(file),
			);
			if (supportedFiles.length > 0) {
				const hasImages = supportedFiles.some(isImageAttachmentFile);
				if (hasImages && !currentModelSupportsAttachments) {
					toast.error("Images not supported", {
						description: "The selected model doesn't support image input",
					});
					const textFiles = supportedFiles.filter(
						(f) => !isImageAttachmentFile(f),
					);
					if (textFiles.length > 0) {
						void processFiles(textFiles);
					}
					return;
				}
				void processFiles(supportedFiles);
			}
		}
	};

	const removeAttachment = (id: string) => {
		setSelectedAttachments((prev) =>
			prev.filter((attachment) => attachment.id !== id),
		);
		setAttachmentError(null);
	};

	const waitForProjectToExist = async (projectId: string) => {
		const result = await waitForEventSource(
			`/api/projects/${projectId}/ready`,
			{
				successEvents: ["ready"],
				failureEvents: ["timeout", "error"],
			},
		);
		return result === "ready";
	};

	const ensureMinimumLoadingTime = async (startedAt: number) => {
		const MIN_LOADING_MS = 1800;
		const elapsed = Date.now() - startedAt;
		if (elapsed >= MIN_LOADING_MS) {
			return;
		}

		await new Promise((resolve) =>
			setTimeout(resolve, MIN_LOADING_MS - elapsed),
		);
	};

	const handleCreate = async () => {
		if (!prompt.trim()) return;

		setIsLoading(true);
		setError("");
		const loadingStartedAt = Date.now();

		try {
			const result = await actions.projects.create({
				prompt: prompt.trim(),
				model: selectedModel ? buildFullModelId(selectedModel) : undefined,
				attachments:
					selectedAttachments.length > 0
						? JSON.stringify(
								selectedAttachments
									.filter(
										(
											attachment,
										): attachment is PromptAttachmentPart & {
											dataUrl: string;
										} => typeof attachment.dataUrl === "string",
									)
									.map((attachment) => ({
										filename: attachment.filename,
										mime: attachment.mime,
										dataUrl: attachment.dataUrl,
										kind: attachment.kind,
										textContent: attachment.textContent,
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

			const projectExists = await waitForProjectToExist(result.data.projectId);
			await ensureMinimumLoadingTime(loadingStartedAt);

			if (!projectExists) {
				setError("Project creation is taking longer than expected");
				setIsLoading(false);
				return;
			}

			window.location.replace(`/projects/${result.data.projectId}`);
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
		const newModelSupportsAttachments =
			newModelConfig?.supportsAttachments ?? true;

		if (selectedAttachments.length > 0 && !newModelSupportsAttachments) {
			const textAttachments = selectedAttachments.filter(
				(a) => a.kind !== "image",
			);
			const imageAttachments = selectedAttachments.filter(
				(a) => a.kind === "image",
			);
			if (imageAttachments.length > 0) {
				setSelectedAttachments(textAttachments);
				setAttachmentError(null);
				toast.info("Images cleared", {
					description: "The selected model doesn't support image input",
				});
			}
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
	const currentModelSupportsAttachments = (() => {
		if (!selectedModel) return true;
		const [providerId, ...modelIdParts] = selectedModel.split(":");
		const modelId = modelIdParts.join(":");
		return (
			models.find((m) => m.id === modelId && m.provider === providerId)
				?.supportsAttachments ?? true
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
		selectedAttachments,
		attachmentError,
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
		removeAttachment,
		handleCreate,
		handleKeyDown,
		handleModelChange,
		handleGoToSettings,
		adjustTextareaHeight,

		// Computed values
		currentModelSupportsAttachments,
		hasModels,
		attachmentAccept: CHAT_ATTACHMENT_ACCEPT,
	};
}
