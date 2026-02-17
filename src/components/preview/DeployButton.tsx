import {
	AlertTriangle,
	CheckCircle2,
	Loader2,
	RefreshCw,
	Rocket,
	RotateCcw,
	Square,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ActiveProductionJob } from "@/server/productions/productions.model";
import type { ProductionVersion } from "./DeploymentVersionHistory";
import { DeploymentVersionHistory } from "./DeploymentVersionHistory";

interface DeployButtonState {
	status: "queued" | "building" | "running" | "failed" | "stopped";
	url: string | null;
	error: string | null;
	activeJob: ActiveProductionJob | null;
}

interface DeployButtonProps {
	state: DeployButtonState;
	previewReady: boolean;
	onDeploy: () => void;
	onStop: () => void;
	versions?: ProductionVersion[];
	onRollback?: (hash: string) => Promise<void>;
}

export function DeployButton({
	state,
	previewReady,
	onDeploy,
	onStop,
	versions,
	onRollback,
}: DeployButtonProps) {
	const [isHovering, setIsHovering] = useState(false);
	const [hoverTimeoutId, setHoverTimeoutId] = useState<ReturnType<
		typeof setTimeout
	> | null>(null);
	const [isRollingBack, setIsRollingBack] = useState(false);

	// Derive button appearance from queue state
	const isQueued = state.activeJob?.state === "queued";
	const isBuilding =
		state.activeJob && state.activeJob.type !== "production.stop";
	const isStopping = state.activeJob?.type === "production.stop";
	const isDeployed = state.status === "running" && !state.activeJob;
	const isFailed = state.status === "failed";
	const hasBeenDeployed = state.status !== "stopped";

	const handleMouseEnter = () => {
		if (hoverTimeoutId) {
			clearTimeout(hoverTimeoutId);
			setHoverTimeoutId(null);
		}
		setIsHovering(true);
	};

	const handleMouseLeave = () => {
		const timeoutId = setTimeout(() => {
			setIsHovering(false);
		}, 200);
		setHoverTimeoutId(timeoutId);
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: This is a container for hover-based interaction
		<div
			className="relative"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{/* Main button */}
			<Button
				size="sm"
				className="gap-2"
				disabled={isQueued || isBuilding || isStopping || !previewReady}
				variant={isDeployed ? "default" : "outline"}
				onClick={isDeployed ? undefined : onDeploy}
			>
				{isStopping ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin" />
						Stopping...
					</>
				) : isBuilding ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin" />
						Building...
					</>
				) : isQueued ? (
					<>
						<Loader2 className="h-4 w-4 animate-spin" />
						Queued...
					</>
				) : isDeployed ? (
					<>
						<CheckCircle2 className="h-4 w-4" />
						Deployed
					</>
				) : isFailed ? (
					<>
						<AlertTriangle className="h-4 w-4" />
						Failed
					</>
				) : (
					<>
						<Rocket className="h-4 w-4" />
						Deploy
					</>
				)}
			</Button>

			{/* Dropdown - shown on hover if deployed at least once */}
			{hasBeenDeployed && isHovering && (
				<div className="absolute top-full right-0 mt-1 w-72 bg-background border border-border rounded-lg shadow-lg p-4 space-y-3 z-50">
					{/* Stopping State */}
					{isStopping && (
						<>
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin text-orange-500" />
								<span className="font-medium text-sm">Stopping...</span>
							</div>
							<p className="text-xs text-muted-foreground">
								Stopping production container
							</p>
						</>
					)}

					{/* Building/Queued State - show current URL while building */}
					{isBuilding && !isStopping && (
						<>
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin text-status-info" />
								<span className="font-medium text-sm">
									{isQueued ? "Queued" : "Building"}...
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								{isQueued
									? "Waiting to start deployment"
									: "Compiling code and starting production container"}
							</p>

							{/* Show current production URL while building */}
							{state.url && (
								<div className="space-y-2 border-t border-border pt-3 mt-3">
									<p className="text-xs text-muted-foreground">
										Current Production URL:
									</p>
									<a
										href={state.url}
										target="_blank"
										rel="noopener noreferrer"
										className="block text-sm text-status-info hover:text-status-info hover:underline break-all"
									>
										{state.url}
									</a>
									<p className="text-xs text-muted-foreground mt-2">
										This deployment will replace the current one once building
										completes.
									</p>
								</div>
							)}
						</>
					)}

					{/* Deployed State */}
					{isDeployed && (
						<>
							<div className="flex items-center gap-2">
								<CheckCircle2 className="h-4 w-4 text-status-success" />
								<span className="font-medium text-sm">Deployed</span>
							</div>

							{state.url && (
								<div className="space-y-2 mt-3">
									<p className="text-xs text-muted-foreground">
										Production URL:
									</p>
									<a
										href={state.url}
										target="_blank"
										rel="noopener noreferrer"
										className="block text-sm text-status-info hover:text-status-info hover:underline break-all"
									>
										{state.url}
									</a>
								</div>
							)}

							<div className="flex gap-2 mt-3">
								<Button
									size="sm"
									variant="outline"
									className="flex-1 gap-2"
									onClick={onDeploy}
									disabled={isRollingBack || !previewReady}
								>
									<RefreshCw className="h-3 w-3" />
									Update
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="flex-1 gap-2"
									onClick={onStop}
									disabled={isRollingBack || !previewReady}
								>
									<Square className="h-3 w-3" />
									Stop
								</Button>
							</div>

							{/* Deployment Version History */}
							{versions && onRollback && (
								<DeploymentVersionHistory
									versions={versions}
									onRollback={async (hash) => {
										setIsRollingBack(true);
										try {
											await onRollback(hash);
										} finally {
											setIsRollingBack(false);
										}
									}}
									isLoading={isRollingBack}
								/>
							)}
						</>
					)}

					{/* Failed State */}
					{isFailed && (
						<>
							<div className="flex items-center gap-2">
								<AlertTriangle className="h-4 w-4 text-status-error" />
								<span className="font-medium text-sm">Deployment Failed</span>
							</div>
							{state.error && (
								<div className="space-y-2">
									<p className="text-xs text-muted-foreground">Error:</p>
									<p className="text-xs text-status-error break-words">
										{state.error.length > 200
											? `${state.error.slice(0, 200)}...`
											: state.error}
									</p>
								</div>
							)}
							<Button
								size="sm"
								variant="outline"
								className="w-full gap-2 mt-2"
								onClick={onDeploy}
								disabled={!previewReady}
							>
								<RotateCcw className="h-3 w-3" />
								Retry
							</Button>
						</>
					)}
				</div>
			)}
		</div>
	);
}
