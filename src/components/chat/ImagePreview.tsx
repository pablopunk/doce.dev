import { X } from "lucide-react";
import { type ImagePart } from "@/types/message";

interface ImagePreviewProps {
	images: ImagePart[];
	onRemove: (id: string) => void;
	disabled?: boolean;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImagePreview({
	images,
	onRemove,
	disabled,
}: ImagePreviewProps) {
	if (images.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2 p-2">
			{images.map((image) => (
				<div
					key={image.id}
					className="relative group rounded-lg overflow-hidden border border-input bg-muted"
				>
					<img
						src={image.dataUrl}
						alt={image.filename}
						className="w-20 h-20 object-cover"
					/>
					<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
						<button
							type="button"
							onClick={() => onRemove(image.id)}
							disabled={disabled}
							className="p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
							title={`Remove ${image.filename}`}
						>
							<X className="w-4 h-4" />
						</button>
					</div>
					<div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1 py-0.5 truncate">
						{image.size ? formatFileSize(image.size) : image.filename}
					</div>
				</div>
			))}
		</div>
	);
}
