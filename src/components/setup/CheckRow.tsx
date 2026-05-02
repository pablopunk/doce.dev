import { AlertTriangle, Check, Loader2 } from "lucide-react";

export type CheckStatus = "pending" | "running" | "ready" | "error";

export interface CheckRowProps {
	label: string;
	status: CheckStatus;
	detail?: string | undefined;
}

export function CheckRow({ label, status, detail }: CheckRowProps) {
	const showDetail = status === "running" || status === "error";

	return (
		<div className="flex items-start gap-3 py-1.5">
			<div className="mt-0.5 flex-shrink-0">
				<StatusIcon status={status} />
			</div>
			<div className="flex flex-col min-w-0 flex-1">
				<span
					className={`text-sm font-medium leading-tight ${
						status === "pending"
							? "text-muted-foreground"
							: status === "error"
								? "text-status-error"
								: "text-foreground"
					}`}
				>
					{label}
				</span>
				<span
					className={`text-xs leading-tight mt-0.5 line-clamp-1 transition-opacity ${
						showDetail && detail ? "opacity-100" : "opacity-0"
					} ${status === "error" ? "text-status-error" : "text-muted-foreground"}`}
					aria-hidden={!showDetail || !detail}
				>
					{detail ?? "\u00A0"}
				</span>
			</div>
		</div>
	);
}

function StatusIcon({ status }: { status: CheckStatus }) {
	switch (status) {
		case "pending":
			return (
				<div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
			);
		case "running":
			return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
		case "ready":
			return (
				<div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
					<Check className="w-3 h-3 text-primary" strokeWidth={3} />
				</div>
			);
		case "error":
			return <AlertTriangle className="w-5 h-5 text-status-error" />;
	}
}
