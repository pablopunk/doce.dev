import { AlertTriangle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AssetUploadZoneProps {
	onUpload: (files: FileList) => Promise<void>;
	isLoading?: boolean;
}

export function AssetUploadZone({
	onUpload,
	isLoading = false,
}: AssetUploadZoneProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = () => {
		setIsDragging(false);
	};

	const handleDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		setError(null);

		if (e.dataTransfer.files.length > 0) {
			try {
				await onUpload(e.dataTransfer.files);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Upload failed");
			}
		}
	};

	const handleFileInputChange = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		setError(null);
		if (e.target.files && e.target.files.length > 0) {
			try {
				await onUpload(e.target.files);
				// Reset input
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Upload failed");
			}
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<section
				aria-label="Asset upload dropzone"
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				className={cn(
					"relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors",
					isDragging
						? "border-primary bg-primary/5"
						: "border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50 hover:bg-muted",
					isLoading && "pointer-events-none opacity-50",
				)}
			>
				<Upload className="h-8 w-8 text-muted-foreground" />
				<div className="text-center">
					<p className="font-medium text-sm">Drag and drop files here</p>
					<p className="text-xs text-muted-foreground mt-1">
						or{" "}
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="text-primary hover:underline"
							disabled={isLoading}
						>
							click to browse
						</button>
					</p>
				</div>
				<p className="text-xs text-muted-foreground mt-2">
					Images, media, and documents up to 50MB
				</p>

				<input
					ref={fileInputRef}
					type="file"
					multiple
					onChange={handleFileInputChange}
					className="hidden"
					disabled={isLoading}
					accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.webm,.mp3,.wav,.pdf,.json,.txt,.md,.csv"
				/>
			</section>

			{error && (
				<div className="flex gap-2 rounded-md bg-status-error-light p-3 text-sm text-status-error">
					<AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
					<p>{error}</p>
				</div>
			)}
		</div>
	);
}
