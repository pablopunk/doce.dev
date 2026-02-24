import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBaseUrlSetting } from "@/hooks/useBaseUrlSetting";
import { mapPortUrlToPreferredHost } from "@/lib/base-url";

export interface ProductionVersion {
	hash: string;
	isActive: boolean;
	createdAt: string;
	url?: string;
	basePort?: number;
	baseUrl?: string | null;
	versionPort?: number;
	previewUrl?: string;
}

interface DeploymentVersionHistoryProps {
	versions: ProductionVersion[];
	onRollback: (hash: string) => Promise<void>;
	isLoading?: boolean;
}

/**
 * Shows deployment version history with ability to rollback to previous versions.
 * Only shows at most 2 versions (current + 1 previous).
 */
export function DeploymentVersionHistory({
	versions,
	onRollback,
	isLoading = false,
}: DeploymentVersionHistoryProps) {
	const { baseUrl } = useBaseUrlSetting();
	const [selectedRollbackHash, setSelectedRollbackHash] = useState<
		string | null
	>(null);
	const [isRollingBack, setIsRollingBack] = useState(false);

	const normalizeDisplayUrl = (url: string | undefined): string | undefined => {
		if (!url || typeof window === "undefined") {
			return url;
		}

		return (
			mapPortUrlToPreferredHost(url, baseUrl, window.location.origin) ?? url
		);
	};

	if (!versions || versions.length === 0) {
		return null;
	}

	const currentVersion = versions.find((v) => v.isActive);
	const previousVersion = versions.find((v) => !v.isActive);

	if (!currentVersion) {
		return null;
	}

	const currentVersionUrl = normalizeDisplayUrl(
		currentVersion.url || currentVersion.previewUrl,
	);
	const previousVersionUrl = normalizeDisplayUrl(
		previousVersion?.url || previousVersion?.previewUrl,
	);

	const handleRollbackConfirm = async () => {
		if (!selectedRollbackHash) return;

		try {
			setIsRollingBack(true);
			await onRollback(selectedRollbackHash);
		} finally {
			setIsRollingBack(false);
			setSelectedRollbackHash(null);
		}
	};

	return (
		<>
			<div className="border-t border-neutral-700 pt-3 mt-3">
				<div className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2">
					Deployments
				</div>

				{/* Current Version */}
				<button
					type="button"
					onClick={() => {
						if (currentVersionUrl) {
							window.open(currentVersionUrl, "_blank");
						}
					}}
					disabled={!currentVersionUrl}
					className="mb-2 w-full flex items-center justify-between px-2 py-2 rounded bg-neutral-800/50 hover:bg-neutral-800 disabled:hover:bg-neutral-800/50 transition-colors disabled:cursor-default"
				>
					<div className="flex items-center gap-2 flex-1 min-w-0">
						<div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center">
							<span className="text-xs text-green-400">✓</span>
						</div>
						<div className="flex-1 min-w-0">
							<div className="text-sm font-medium text-neutral-100 truncate">
								{currentVersion.hash.slice(0, 8)}
							</div>
							<div className="text-xs text-neutral-500">
								{new Date(currentVersion.createdAt).toLocaleString()}
							</div>
							{currentVersionUrl && (
								<div className="text-xs text-blue-400 truncate">
									{currentVersionUrl}
								</div>
							)}
							{currentVersion.basePort && (
								<div className="text-xs text-neutral-400">
									Port: {currentVersion.basePort}
								</div>
							)}
						</div>
					</div>
					<div className="flex-shrink-0 ml-2 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-xs font-medium text-green-400">
						Active
					</div>
				</button>

				{/* Previous Version */}
				{previousVersion && (
					<div className="flex items-center justify-between px-2 py-2 rounded bg-neutral-800/30 group">
						<button
							type="button"
							onClick={() => {
								if (previousVersionUrl) {
									window.open(previousVersionUrl, "_blank");
								}
							}}
							disabled={!previousVersionUrl}
							className="flex-1 flex items-center gap-2 min-w-0 hover:opacity-80 disabled:hover:opacity-100 disabled:cursor-default transition-opacity"
						>
							<div className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral-600 flex items-center justify-center">
								<span className="text-xs text-neutral-400">○</span>
							</div>
							<div className="flex-1 min-w-0 text-left">
								<div className="text-sm font-medium text-neutral-300 truncate">
									{previousVersion.hash.slice(0, 8)}
								</div>
								<div className="text-xs text-neutral-500">
									{new Date(previousVersion.createdAt).toLocaleString()}
								</div>
								{previousVersionUrl && (
									<div className="text-xs text-blue-400 truncate">
										{previousVersionUrl}
									</div>
								)}
								{previousVersion.versionPort && (
									<div className="text-xs text-neutral-400">
										Port: {previousVersion.versionPort}
									</div>
								)}
							</div>
						</button>
						<button
							type="button"
							onClick={() => setSelectedRollbackHash(previousVersion.hash)}
							disabled={isLoading || isRollingBack}
							className="flex-shrink-0 ml-2 px-2 py-1 text-xs font-medium rounded border border-neutral-500 text-neutral-300 hover:text-neutral-100 hover:border-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							Rollback
						</button>
					</div>
				)}
			</div>

			{/* Rollback Confirmation Dialog */}
			<AlertDialog
				open={selectedRollbackHash !== null}
				onOpenChange={(open) => {
					if (!open) setSelectedRollbackHash(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Rollback Deployment</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to rollback to version{" "}
							<code className="bg-neutral-800 px-2 py-1 rounded text-sm font-mono text-neutral-200">
								{selectedRollbackHash}
							</code>
							? The current deployment will be stopped and replaced.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="flex gap-3 justify-end">
						<AlertDialogCancel disabled={isRollingBack}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleRollbackConfirm}
							disabled={isRollingBack}
							className="bg-destructive hover:bg-destructive/80"
						>
							{isRollingBack ? "Rolling back..." : "Rollback"}
						</AlertDialogAction>
					</div>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
