import { Loader2, Paperclip, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { AttachmentPreview } from "@/components/chat/AttachmentPreview";
import { Button } from "@/components/ui/button";
import type { PromptAttachmentPart } from "@/types/message";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@/types/message";
import { ModelSelector } from "./ModelSelector";

interface Model {
	id: string;
	name: string;
	provider: string;
	vendor: string;
	supportsImages?: boolean;
	supportsAttachments?: boolean;
}

interface CreateProjectFormContentProps {
	prompt: string;
	selectedModel: string | undefined;
	models: Model[];
	selectedAttachments: PromptAttachmentPart[];
	isDragging: boolean;
	isLoading: boolean;
	error: string;
	attachmentError: string | null;
	currentModelSupportsAttachments: boolean;
	attachmentAccept: string;
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
	onRemoveAttachment: (id: string) => void;
	onCreate: () => void;
	onModelChange: (compositeKey: string) => void;
}

export function CreateProjectFormContent({
	prompt,
	selectedModel,
	models,
	selectedAttachments,
	isDragging,
	isLoading,
	error,
	attachmentError,
	currentModelSupportsAttachments,
	attachmentAccept,
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
	onRemoveAttachment,
	onCreate,
	onModelChange,
}: CreateProjectFormContentProps) {
	return (
		<div className="w-full relative">
			<div className="flex flex-col gap-4">
				<div className="relative rounded-2xl">
					{isLoading && (
						<motion.div
							className="absolute -inset-[2px] rounded-2xl blur-lg opacity-50"
							animate={{ backgroundPositionX: ["0%", "200%"] }}
							transition={{
								repeat: Number.POSITIVE_INFINITY,
								duration: 10,
								ease: "linear",
							}}
							style={{
								background:
									"linear-gradient(90deg, var(--cta-accent-start), var(--cta-accent-mid), oklch(0.82 0.2 95), var(--cta-accent-end), oklch(0.82 0.2 95), var(--cta-accent-mid), var(--cta-accent-start), var(--cta-accent-start), var(--cta-accent-mid), oklch(0.82 0.2 95), var(--cta-accent-end), oklch(0.82 0.2 95), var(--cta-accent-mid), var(--cta-accent-start))",
								backgroundSize: "200% 100%",
							}}
						/>
					)}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: This is a drop zone container */}
					<div
						className={`relative z-10 flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors ${
							isDragging ? "border-primary bg-primary/5" : "border-input"
						}`}
						onDragOver={onDragOver}
						onDragLeave={onDragLeave}
						onDrop={onDrop}
					>
						<div className="relative flex-1">
							<textarea
								ref={textareaRef}
								value={prompt}
								onChange={(e) => onPromptChange(e.target.value)}
								onKeyDown={onKeyDown}
								onPaste={onPaste}
								placeholder="It all starts here..."
								title="Use Ctrl+Enter (or Cmd+Enter on Mac) to create a project"
								className={`h-full w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground focus:outline-none ${
									isLoading ? "caret-transparent text-transparent" : ""
								}`}
								rows={1}
								style={{ minHeight: "80px" }}
								disabled={isLoading}
							/>
							{isLoading && (
								<motion.div
									className="absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-base"
									animate={{ backgroundPositionX: ["0%", "200%"] }}
									transition={{
										repeat: Number.POSITIVE_INFINITY,
										duration: 10,
										ease: "linear",
									}}
									style={{
										background:
											"linear-gradient(90deg, var(--cta-accent-start), var(--cta-accent-mid), oklch(0.82 0.2 95), var(--cta-accent-end), oklch(0.82 0.2 95), var(--cta-accent-mid), var(--cta-accent-start), var(--cta-accent-start), var(--cta-accent-mid), oklch(0.82 0.2 95), var(--cta-accent-end), oklch(0.82 0.2 95), var(--cta-accent-mid), var(--cta-accent-start))",
										backgroundSize: "200% 100%",
										WebkitBackgroundClip: "text",
										backgroundClip: "text",
										color: "transparent",
									}}
								>
									{prompt}
								</motion.div>
							)}
						</div>
						{selectedAttachments.length > 0 && (
							<AttachmentPreview
								attachments={selectedAttachments}
								onRemove={onRemoveAttachment}
								disabled={isLoading}
							/>
						)}
						{attachmentError && (
							<p className="text-sm text-destructive">{attachmentError}</p>
						)}
						<div className="flex min-w-0 items-center justify-between gap-2">
							<ModelSelector
								models={models}
								selectedModelId={selectedModel || ""}
								onModelChange={onModelChange}
								triggerClassName="max-w-[150px] min-[420px]:max-w-[200px] min-w-0"
							/>
							<div className="shrink-0 flex items-center gap-1.5">
								{currentModelSupportsAttachments && (
									<input
										ref={fileInputRef}
										type="file"
										accept={attachmentAccept}
										multiple
										onChange={onFileSelect}
										className="hidden"
									/>
								)}
								{currentModelSupportsAttachments && (
									<Button
										variant="ghost"
										size="icon"
										onClick={onFileButtonClick}
										disabled={
											isLoading ||
											selectedAttachments.length >= MAX_ATTACHMENTS_PER_MESSAGE
										}
										title={`Attach files (${selectedAttachments.length}/${MAX_ATTACHMENTS_PER_MESSAGE})`}
										type="button"
									>
										<Paperclip className="h-5 w-5" />
										{selectedAttachments.length > 0 && (
											<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
												{selectedAttachments.length}
											</span>
										)}
									</Button>
								)}
								<Button
									onClick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										onCreate();
									}}
									disabled={
										isLoading ||
										(!prompt.trim() && selectedAttachments.length === 0)
									}
									title="Create project (or press Ctrl+Enter in textarea)"
									type="button"
									className="px-2.5 min-[380px]:px-3"
								>
									{isLoading ? (
										<Loader2 className="h-5 w-5 animate-spin" />
									) : (
										<Sparkles className="h-5 w-5 text-cta-accent-start" />
									)}
									<span className="hidden min-[380px]:inline bg-gradient-to-r from-cta-accent-start via-cta-accent-mid to-cta-accent-end bg-clip-text font-semibold text-transparent">
										Create
									</span>
								</Button>
							</div>
						</div>
					</div>
				</div>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</div>
		</div>
	);
}
