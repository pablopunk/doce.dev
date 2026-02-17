import { Upload } from "lucide-react";
import { useState } from "react";
import { AssetItem } from "./AssetItem";

interface Asset {
	name: string;
	path: string;
	size: number;
	mimeType: string;
	isImage: boolean;
}

interface AssetsListProps {
	assets: Asset[];
	onRename: (oldName: string, newName: string) => Promise<void>;
	onDelete: (path: string) => Promise<void>;
	onUpload: (files: FileList) => Promise<void>;
	isLoading?: boolean;
	previewUrl?: string;
}

export function AssetsList({
	assets,
	onRename,
	onDelete,
	onUpload,
	isLoading = false,
	previewUrl,
}: AssetsListProps) {
	const [isDragging, setIsDragging] = useState(false);

	if (assets.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-muted-foreground">
				<p className="text-sm">
					No assets yet. Upload some files to get started.
				</p>
			</div>
		);
	}

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
		if (e.dataTransfer.files.length > 0) {
			try {
				await onUpload(e.dataTransfer.files);
			} catch (_err) {
				// Error handled by parent component
			}
		}
	};

	return (
		<section
			aria-label="Assets list dropzone"
			className="p-4 h-full overflow-y-auto relative"
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<div
				className="grid gap-4"
				style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
			>
				{assets.map((asset) => (
					<AssetItem
						key={asset.name}
						asset={asset}
						onRename={onRename}
						onDelete={onDelete}
						isLoading={isLoading}
						{...(previewUrl ? { previewUrl } : {})}
					/>
				))}
			</div>

			{/* Drag overlay - shows on hover with file */}
			{isDragging && (
				<div className="absolute inset-0 bg-primary/10 rounded-lg flex items-center justify-center pointer-events-none">
					<div className="flex flex-col items-center gap-2 text-primary">
						<Upload className="h-8 w-8" />
						<p className="text-sm font-medium">Drop files to upload</p>
					</div>
				</div>
			)}
		</section>
	);
}
