import {
	AlertTriangle,
	CheckCircle2,
	Loader2,
	Rocket,
	RotateCcw,
	Square,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DeployButtonProps {
	status: "queued" | "building" | "running" | "failed" | "stopped" | null;
	error: string | null;
	url: string | null;
	isDeploying: boolean;
	isStopping: boolean;
	previewReady: boolean;
	onRetry: () => void;
	onStop: () => void;
}

export function DeployButton({
	status,
	error,
	url,
	isDeploying,
	isStopping,
	previewReady,
	onRetry,
	onStop,
}: DeployButtonProps) {
	const [isHovering, setIsHovering] = useState(false);
	const [hoverTimeoutId, setHoverTimeoutId] = useState<ReturnType<
		typeof setTimeout
	> | null>(null);

	// Determine if we've ever deployed (has been touched)
	const hasBeenDeployed = status !== null && status !== "stopped";

	// Determine button state
	const isBuilding =
		isDeploying || status === "building" || status === "queued";
	const isDeployed = status === "running" && !isStopping;
	const isFailed = status === "failed" && !isStopping;

	const handleMouseEnter = () => {
		if (hoverTimeoutId) {
			clearTimeout(hoverTimeoutId);
			setHoverTimeoutId(null);
		}
		setIsHovering(true);
	};

	const handleMouseLeave = () => {
		// Wait 200ms before closing dropdown, allowing mouse to move through gap
		const timeoutId = setTimeout(() => {
			setIsHovering(false);
		}, 200);
		setHoverTimeoutId(timeoutId);
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: This is a container for hover-based interaction
		<div
			className="relative pb-2"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
		>
			{/* Button - triggers deploy when in Deploy state */}
			<Button
				size="sm"
				className="gap-2"
				disabled={isBuilding || isStopping || !previewReady}
				variant={isDeployed ? "default" : "outline"}
				onClick={isDeployed ? undefined : onRetry}
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

			{/* Popover content - shown on hover only if deployed at least once */}
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

					{/* Building State */}
					{isBuilding && !isStopping && (
						<>
							<div className="flex items-center gap-2">
								<Loader2 className="h-4 w-4 animate-spin text-blue-500" />
								<span className="font-medium text-sm">Building...</span>
							</div>
							<p className="text-xs text-muted-foreground">
								Compiling code and starting production container
							</p>
						</>
					)}

					{/* Deployed State */}
					{isDeployed && (
						<>
							<div className="flex items-center gap-2">
								<CheckCircle2 className="h-4 w-4 text-green-500" />
								<span className="font-medium text-sm">Deployed</span>
							</div>
							{url ? (
								<div className="space-y-2">
									<p className="text-xs text-muted-foreground">
										Production URL:
									</p>
									<a
										href={url}
										target="_blank"
										rel="noopener noreferrer"
										className="block text-sm text-blue-500 hover:text-blue-600 hover:underline break-all"
									>
										{url}
									</a>
									<Button
										size="sm"
										variant="outline"
										className="w-full gap-2 mt-2"
										onClick={onStop}
										disabled={!previewReady || isStopping}
									>
										<Square className="h-3 w-3" />
										Stop
									</Button>
								</div>
							) : null}
						</>
					)}

					{/* Failed State */}
					{isFailed && (
						<>
							<div className="flex items-center gap-2">
								<AlertTriangle className="h-4 w-4 text-red-500" />
								<span className="font-medium text-sm">Deployment Failed</span>
							</div>
							{error && (
								<div className="space-y-2">
									<p className="text-xs text-muted-foreground">Error:</p>
									<p className="text-xs text-red-500 break-words">
										{error.length > 200 ? `${error.slice(0, 200)}...` : error}
									</p>
								</div>
							)}
							<Button
								size="sm"
								variant="outline"
								className="w-full gap-2 mt-2"
								onClick={onRetry}
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
