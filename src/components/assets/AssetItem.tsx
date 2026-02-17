import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface Asset {
	name: string;
	path: string;
	size: number;
	mimeType: string;
	isImage: boolean;
}

interface AssetItemProps {
	asset: Asset;
	onRename: (oldName: string, newName: string) => Promise<void>;
	onDelete: (path: string) => Promise<void>;
	isLoading?: boolean;
	previewUrl?: string;
}

export function AssetItem({
	asset,
	onRename,
	onDelete,
	isLoading = false,
	previewUrl,
}: AssetItemProps) {
	const [isRenaming, setIsRenaming] = useState(false);
	const [newName, setNewName] = useState(asset.name);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const getExtension = (filename: string): string => {
		const lastDot = filename.lastIndexOf(".");
		return lastDot > 0 ? filename.slice(lastDot) : "";
	};

	const getBaseName = (filename: string): string => {
		const lastDot = filename.lastIndexOf(".");
		return lastDot > 0 ? filename.slice(0, lastDot) : filename;
	};

	const handleRenameStart = () => {
		setIsRenaming(true);
		// Only set the base name (without extension) for editing
		setNewName(getBaseName(asset.name));
	};

	const handleRenameSave = async () => {
		if (!newName.trim()) {
			setIsRenaming(false);
			return;
		}

		// Reconstruct full name with original extension
		const ext = getExtension(asset.name);
		const fullNewName = newName.trim() + ext;

		if (fullNewName === asset.name) {
			setIsRenaming(false);
			return;
		}

		try {
			setIsSaving(true);
			await onRename(asset.name, fullNewName);
			setIsRenaming(false);
		} catch (_error) {
			// Error will be shown by parent component
		} finally {
			setIsSaving(false);
		}
	};

	const handleRenameCancel = () => {
		setIsRenaming(false);
		setNewName(getBaseName(asset.name));
	};

	const handleRenameKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleRenameSave();
		} else if (e.key === "Escape") {
			handleRenameCancel();
		}
	};

	const handleCopyUrl = () => {
		navigator.clipboard.writeText(`/${asset.path}`);
		// Toast feedback is handled by parent
	};

	const handleDeleteConfirm = async () => {
		try {
			setIsDeleting(true);
			await onDelete(asset.path);
			setShowDeleteDialog(false);
		} catch (_error) {
			// Error will be shown by parent component
		} finally {
			setIsDeleting(false);
		}
	};

	const getFileIcon = () => {
		const ext = asset.name.split(".").pop()?.toLowerCase();
		switch (ext) {
			case "pdf":
				return "📄";
			case "json":
			case "txt":
			case "md":
			case "csv":
				return "📋";
			case "mp4":
			case "webm":
				return "🎬";
			case "mp3":
			case "wav":
				return "🔊";
			default:
				return "📁";
		}
	};

	return (
		<>
			<div className="group flex flex-col gap-2 rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors">
				{/* Thumbnail/Icon */}
				<div className="relative aspect-square w-full rounded bg-muted flex items-center justify-center overflow-hidden">
					{asset.isImage ? (
						<img
							src={
								previewUrl ? `${previewUrl}/${asset.name}` : `/${asset.name}`
							}
							alt={asset.name}
							className="w-full h-full object-cover"
						/>
					) : (
						<div className="text-4xl">{getFileIcon()}</div>
					)}

					{/* Action buttons overlay */}
					{!isRenaming && (
						<div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-1 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto">
							<Button
								onClick={handleCopyUrl}
								variant="secondary"
								size="xs"
								title="Copy URL"
							>
								<Copy className="w-3 h-3" />
							</Button>
							<Button
								onClick={handleRenameStart}
								variant="secondary"
								size="xs"
								disabled={isLoading}
								title="Rename"
							>
								<Pencil className="w-3 h-3" />
							</Button>
							<Button
								onClick={() => setShowDeleteDialog(true)}
								variant="destructive"
								size="xs"
								disabled={isLoading}
								title="Delete"
							>
								<Trash2 className="w-3 h-3" />
							</Button>
						</div>
					)}
				</div>

				{/* Filename / Rename input */}
				<div className="min-h-[2.5rem] flex items-center">
					{isRenaming ? (
						<div className="w-full flex items-center gap-1">
							<input
								type="text"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={handleRenameKeyDown}
								className="flex-1 min-w-0 text-xs px-2 py-1 rounded border bg-background text-foreground"
								disabled={isSaving}
								placeholder="Name..."
							/>
							<span className="text-xs text-muted-foreground flex-shrink-0">
								{getExtension(asset.name)}
							</span>
						</div>
					) : (
						<div className="w-full">
							<p
								className="text-xs font-medium truncate break-all"
								title={asset.name}
							>
								{asset.name}
							</p>
							<p className="text-xs text-muted-foreground">
								{(asset.size / 1024).toFixed(1)} KB
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Delete confirmation dialog */}
			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Asset</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete{" "}
							<span className="font-medium">{asset.name}</span>? This action
							cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<div className="flex gap-2 justify-end">
						<Button
							variant="outline"
							onClick={() => setShowDeleteDialog(false)}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteConfirm}
							disabled={isDeleting}
						>
							Delete
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
