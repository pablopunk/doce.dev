import { Loader2, Paperclip, Send } from "lucide-react";
import {
	type ClipboardEvent,
	type DragEvent,
	type FormEvent,
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { ModelSelector } from "@/components/dashboard/ModelSelector";
import { Button } from "@/components/ui/button";
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
import { AttachmentPreview } from "./AttachmentPreview";

interface ChatInputProps {
	onSend: (message: string, attachments?: PromptAttachmentPart[]) => void;
	disabled?: boolean;
	placeholder?: string;
	model?: string | null;
	models?: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		supportsImages?: boolean;
		supportsAttachments?: boolean;
	}>;
	onModelChange?: (modelId: string) => void;
	attachments?: PromptAttachmentPart[];
	onAttachmentsChange?: (attachments: PromptAttachmentPart[]) => void;
	attachmentError?: string | null;
	onAttachmentError?: (error: string | null) => void;
	supportsAttachments?: boolean;
	seedDraft?: {
		key: number;
		text: string;
		attachments: PromptAttachmentPart[];
	} | null;
	onSeedConsumed?: () => void;
}

export function ChatInput({
	onSend,
	disabled = false,
	placeholder = "Type a message...",
	model = null,
	models = [],
	onModelChange,
	attachments: externalAttachments,
	onAttachmentsChange,
	attachmentError: externalAttachmentError,
	onAttachmentError,
	supportsAttachments = true,
	seedDraft = null,
	onSeedConsumed,
}: ChatInputProps) {
	const [message, setMessage] = useState("");
	const [internalAttachments, setInternalAttachments] = useState<
		PromptAttachmentPart[]
	>([]);
	const [internalAttachmentError, setInternalAttachmentError] = useState<
		string | null
	>(null);
	const [isDragging, setIsDragging] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const selectedAttachments = externalAttachments ?? internalAttachments;
	const attachmentError = externalAttachmentError ?? internalAttachmentError;

	const updateAttachments = (
		updater:
			| PromptAttachmentPart[]
			| ((prev: PromptAttachmentPart[]) => PromptAttachmentPart[]),
	) => {
		const newAttachments =
			typeof updater === "function" ? updater(selectedAttachments) : updater;
		if (onAttachmentsChange) {
			onAttachmentsChange(newAttachments);
		} else {
			setInternalAttachments(newAttachments);
		}
	};

	const updateAttachmentError = (error: string | null) => {
		if (onAttachmentError) {
			onAttachmentError(error);
		} else {
			setInternalAttachmentError(error);
		}
	};

	const adjustTextareaHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		textarea.style.height = "auto";
		const scrollHeight = textarea.scrollHeight;
		const maxHeight = 200;
		textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
	}, []);

	useEffect(() => {
		adjustTextareaHeight();
	}, [adjustTextareaHeight]);

	const lastSeedKeyRef = useRef<number | null>(null);
	// updateAttachments closes over selectedAttachments; we deliberately re-run only on key change.
	// biome-ignore lint/correctness/useExhaustiveDependencies: see comment
	useEffect(() => {
		if (!seedDraft) return;
		if (lastSeedKeyRef.current === seedDraft.key) return;
		lastSeedKeyRef.current = seedDraft.key;
		setMessage(seedDraft.text);
		if (seedDraft.attachments.length > 0 && supportsAttachments) {
			updateAttachments(seedDraft.attachments);
		}
		onSeedConsumed?.();
		requestAnimationFrame(() => {
			const el = textareaRef.current;
			if (el) {
				el.focus();
				el.setSelectionRange(el.value.length, el.value.length);
			}
			adjustTextareaHeight();
		});
	}, [seedDraft, supportsAttachments, onSeedConsumed, adjustTextareaHeight]);

	const processFiles = async (files: FileList | File[]) => {
		if (!supportsAttachments) return;

		updateAttachmentError(null);
		const fileArray = Array.from(files);
		const totalCount = selectedAttachments.length + fileArray.length;
		if (totalCount > MAX_ATTACHMENTS_PER_MESSAGE) {
			updateAttachmentError(
				`Max ${MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed`,
			);
			return;
		}

		const newAttachments: PromptAttachmentPart[] = [];
		for (const file of fileArray) {
			const isImage = isImageAttachmentFile(file);
			const validation = isImage
				? validateImageFile(file)
				: validateTextAttachmentFile(file);
			if (!validation.valid) {
				updateAttachmentError(validation.error || "Invalid file");
				return;
			}

			try {
				newAttachments.push(await createPromptAttachmentFromFile(file));
			} catch {
				updateAttachmentError(`Failed to read ${file.name}`);
				return;
			}
		}

		updateAttachments((prev) => [...prev, ...newAttachments]);
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			void processFiles(e.target.files);
		}
		e.target.value = "";
	};

	const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
		if (!supportsAttachments) return;

		const items = e.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];
		for (const item of items) {
			const file = item.getAsFile();
			if (file && isImageAttachmentFile(file)) {
				files.push(file);
			}
		}

		if (files.length > 0) {
			e.preventDefault();
			void processFiles(files);
		}
	};

	const handleDragOver = (e: DragEvent<HTMLElement>) => {
		if (!supportsAttachments) return;
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	};

	const handleDragLeave = (e: DragEvent<HTMLElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	};

	const handleDrop = (e: DragEvent<HTMLElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);

		const files = e.dataTransfer?.files;
		if (!files || files.length === 0) return;

		if (!supportsAttachments) {
			toast.error("Attachments not supported", {
				description: "The selected model doesn't support file attachments",
			});
			return;
		}

		const supportedFiles = Array.from(files).filter(
			(file) => isImageAttachmentFile(file) || isTextAttachmentFile(file),
		);
		if (supportedFiles.length === 0) {
			toast.error("Unsupported file type", {
				description:
					"Drop a text file, markdown, CSV, JSON, YAML, XML, log, source file, or image.",
			});
			return;
		}

		void processFiles(supportedFiles);
	};

	const removeAttachment = (id: string) => {
		updateAttachments((prev) =>
			prev.filter((attachment) => attachment.id !== id),
		);
		updateAttachmentError(null);
	};

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		const trimmed = message.trim();
		const hasContent = trimmed || selectedAttachments.length > 0;
		if (!hasContent || disabled) return;

		onSend(
			trimmed,
			selectedAttachments.length > 0 ? selectedAttachments : undefined,
		);
		setMessage("");
		updateAttachments([]);
		updateAttachmentError(null);

		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key !== "Enter") return;

		const hasModifier = e.ctrlKey || e.metaKey || e.shiftKey;
		if (hasModifier) return;

		e.preventDefault();
		const hasContent = message.trim() || selectedAttachments.length > 0;
		if (hasContent && !disabled) {
			handleSubmit(e);
		}
	};

	const hasContent = message.trim() || selectedAttachments.length > 0;

	return (
		<div className="w-full px-2 pb-2 pt-1">
			<div className="flex flex-col gap-2">
				<form
					className={`flex flex-col gap-2 rounded-lg border bg-card p-2 transition-colors ${
						isDragging && supportsAttachments
							? "border-primary bg-primary/5"
							: "border-input"
					}`}
					onSubmit={(e) => e.preventDefault()}
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
						title="Press Enter to send, Shift+Enter for new line"
						className="flex-1 resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground focus:outline-none"
						rows={1}
						style={{ minHeight: "56px" }}
						disabled={disabled}
					/>
					{selectedAttachments.length > 0 && (
						<AttachmentPreview
							attachments={selectedAttachments}
							onRemove={removeAttachment}
							disabled={disabled}
						/>
					)}
					{attachmentError && (
						<p className="text-sm text-destructive">{attachmentError}</p>
					)}
					<div className="flex items-center justify-between gap-2">
						{models.length > 0 && onModelChange && (
							<ModelSelector
								models={models}
								selectedModelId={model || ""}
								onModelChange={onModelChange}
							/>
						)}
						<div className="flex items-center gap-2">
							{supportsAttachments && (
								<input
									ref={fileInputRef}
									type="file"
									accept={CHAT_ATTACHMENT_ACCEPT}
									multiple
									onChange={handleFileSelect}
									className="hidden"
								/>
							)}
							{supportsAttachments && (
								<Button
									variant="ghost"
									size="icon"
									onClick={() => fileInputRef.current?.click()}
									disabled={
										disabled ||
										selectedAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE
									}
									title={`Attach files (${selectedAttachments.length}/${MAX_ATTACHMENTS_PER_MESSAGE})`}
									type="button"
								>
									<Paperclip className="w-5 h-5" />
									{selectedAttachments.length > 0 && (
										<span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
											{selectedAttachments.length}
										</span>
									)}
								</Button>
							)}
							<Button
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									handleSubmit(e);
								}}
								disabled={disabled || !hasContent}
								title="Send message (Enter)"
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
				</form>
			</div>
		</div>
	);
}
