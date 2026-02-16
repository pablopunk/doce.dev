import { AlertTriangle, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OpencodeErrorCategory } from "@/server/opencode/diagnostics";

interface ProjectDiagnosticBannerProps {
	category: string | null;
	message: string | null;
	onDismiss?: () => void;
}

const CATEGORY_VARIANTS: Record<
	OpencodeErrorCategory,
	"default" | "secondary" | "destructive" | "outline"
> = {
	auth: "destructive",
	provider_model: "outline",
	runtime_unreachable: "secondary",
	timeout: "outline",
	unknown: "secondary",
};

const CATEGORY_TITLES: Record<string, string> = {
	auth: "Authentication Failed",
	provider_model: "Model Error",
	runtime_unreachable: "OpenCode Unavailable",
	timeout: "Request Timed Out",
	unknown: "Unexpected Error",
};

export function ProjectDiagnosticBanner({
	category,
	message,
	onDismiss,
}: ProjectDiagnosticBannerProps) {
	if (!category || !message) return null;

	const title = CATEGORY_TITLES[category] ?? CATEGORY_TITLES.unknown;
	const badgeVariant =
		CATEGORY_VARIANTS[category as OpencodeErrorCategory] ?? "secondary";

	const handleCheckSettings = () => {
		window.location.href = "/settings/providers";
		toast.info("Navigating to provider settings...");
	};

	return (
		<div
			data-testid="opencode-diagnostic-banner"
			className="flex-shrink-0 px-4 py-3 border-b bg-destructive/5 border-destructive/20"
		>
			<div className="flex items-start gap-3">
				<AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive mt-0.5" />
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h4 className="font-medium text-sm">{title}</h4>
						<Badge variant={badgeVariant} className="text-xs">
							{category}
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground mt-1">{message}</p>

					<div className="flex flex-wrap gap-2 mt-2">
						<Button
							size="xs"
							variant="outline"
							onClick={handleCheckSettings}
							className="gap-1"
						>
							<Settings className="h-3 w-3" />
							Check Settings
						</Button>
					</div>
				</div>

				{onDismiss && (
					<Button
						variant="ghost"
						size="icon-xs"
						onClick={onDismiss}
						className="flex-shrink-0 -mt-1 -mr-1"
						title="Dismiss"
					>
						<X className="h-3 w-3" />
					</Button>
				)}
			</div>
		</div>
	);
}
