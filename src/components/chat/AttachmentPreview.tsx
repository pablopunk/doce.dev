import { FileText, ImageIcon, X } from "lucide-react";
import type { PromptAttachmentPart } from "@/types/message";
import { formatFileSize } from "@/types/message";

interface AttachmentPreviewProps {
	attachments: PromptAttachmentPart[];
	onRemove: (id: string) => void;
	disabled?: boolean;
}

export function AttachmentPreview({
	attachments,
	onRemove,
	disabled,
}: AttachmentPreviewProps) {
	if (attachments.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2 p-2">
			{attachments.map((attachment) => {
				const isImage = attachment.kind === "image" && attachment.dataUrl;
				return (
					<div
						key={attachment.id}
						className="group relative flex items-center gap-2 rounded-lg border border-input bg-muted/60 pr-10"
					>
						<div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-l-lg border-r bg-background">
							{isImage ? (
								<img
									src={attachment.dataUrl}
									alt={attachment.filename}
									className="h-full w-full object-cover"
								/>
							) : attachment.kind === "image" ? (
								<ImageIcon className="h-5 w-5 text-muted-foreground" />
							) : (
								<FileText className="h-5 w-5 text-muted-foreground" />
							)}
						</div>
						<div className="min-w-0 py-2 pr-2 text-sm">
							<p className="truncate font-medium">{attachment.filename}</p>
							<p className="truncate text-muted-foreground text-xs">
								{attachment.mime}
								{attachment.size ? ` • ${formatFileSize(attachment.size)}` : ""}
							</p>
							{attachment.kind === "text" && attachment.textPreview && (
								<p className="mt-1 line-clamp-2 max-w-64 text-muted-foreground text-xs">
									{attachment.textPreview}
								</p>
							)}
						</div>
						<button
							type="button"
							onClick={() => onRemove(attachment.id)}
							disabled={disabled}
							className="absolute right-2 top-2 rounded-full bg-background p-1 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
							title={`Remove ${attachment.filename}`}
						>
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
				);
			})}
		</div>
	);
}
