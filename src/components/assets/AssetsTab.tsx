import { actions } from "astro:actions";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AssetsList } from "./AssetsList";
import { AssetUploadZone } from "./AssetUploadZone";

interface Asset {
	name: string;
	path: string;
	size: number;
	mimeType: string;
	isImage: boolean;
}

interface AssetsTabProps {
	projectId: string;
	previewUrl?: string;
}

export function AssetsTab({ projectId, previewUrl }: AssetsTabProps) {
	const [assets, setAssets] = useState<Asset[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isUploading, setIsUploading] = useState(false);

	// Fetch assets on mount
	useEffect(() => {
		const fetchAssets = async () => {
			try {
				setIsLoading(true);
				const result = await actions.assets.list({ projectId });
				if (result.error) {
					toast.error(result.error.message);
				} else if (result.data?.assets) {
					setAssets(result.data.assets);
				}
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Failed to load assets",
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchAssets();
	}, [projectId]);

	const handleUpload = async (files: FileList) => {
		try {
			setIsUploading(true);

			// Create FormData with projectId and files array
			const formData = new FormData();
			formData.append("projectId", projectId);
			// Add each file to the "files" field to create an array
			for (let i = 0; i < files.length; i++) {
				const file = files.item(i);
				if (file) {
					formData.append("files", file);
				}
			}

			// Call the action with FormData
			const result = await actions.assets.upload(formData);

			if (result.error) {
				toast.error(result.error.message);
			} else if (result.data?.success) {
				// Refresh asset list
				const listResult = await actions.assets.list({ projectId });
				if (listResult.error) {
					toast.error(listResult.error.message);
				} else if (listResult.data?.assets) {
					setAssets(listResult.data.assets);
				}

				toast.success(`Uploaded ${result.data.assets.length} file(s)`);
				if (result.data.errors && result.data.errors.length > 0) {
					result.data.errors.forEach((err) => {
						toast.warning(err);
					});
				}
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setIsUploading(false);
		}
	};

	const handleRename = async (oldName: string, newName: string) => {
		try {
			const result = await actions.assets.rename({
				projectId,
				oldName,
				newName,
			});

			if (result.error) {
				toast.error(result.error.message);
				return;
			}

			// Refresh asset list
			const listResult = await actions.assets.list({ projectId });
			if (listResult.error) {
				toast.error(listResult.error.message);
			} else if (listResult.data?.assets) {
				setAssets(listResult.data.assets);
			}

			toast.success(`Renamed to ${newName}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Rename failed");
		}
	};

	const handleDelete = async (path: string) => {
		try {
			const result = await actions.assets.delete({
				projectId,
				path,
			});

			if (result.error) {
				toast.error(result.error.message);
				return;
			}

			// Refresh asset list
			const listResult = await actions.assets.list({ projectId });
			if (listResult.error) {
				toast.error(listResult.error.message);
			} else if (listResult.data?.assets) {
				setAssets(listResult.data.assets);
			}

			toast.success("Asset deleted");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Delete failed");
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="flex flex-col items-center gap-2 text-muted-foreground">
					<Loader2 className="h-8 w-8 animate-spin" />
					<p className="text-sm">Loading assets...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full overflow-hidden">
			{/* Content */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{assets.length === 0 ? (
					<div className="flex-1 flex items-center justify-center p-8">
						<div className="w-full max-w-md">
							<AssetUploadZone
								onUpload={handleUpload}
								isLoading={isUploading}
							/>
						</div>
					</div>
				) : (
					<div className="flex-1 flex flex-col overflow-hidden">
						<div className="px-4 py-2 border-b bg-muted/30">
							<p className="text-xs text-muted-foreground">
								{assets.length} asset{assets.length !== 1 ? "s" : ""}
							</p>
						</div>
						<AssetsList
							assets={assets}
							onRename={handleRename}
							onDelete={handleDelete}
							onUpload={handleUpload}
							isLoading={isUploading}
							previewUrl={previewUrl}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
