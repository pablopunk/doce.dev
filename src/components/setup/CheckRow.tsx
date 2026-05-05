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
		<div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 py-1.5">
			<div className="mt-0.5 flex-shrink-0">
				<StatusIcon status={status} />
			</div>
			<span
				className={`text-sm font-medium leading-5 ${
					status === "pending"
						? "text-muted-foreground"
						: status === "error"
							? "text-status-error"
							: "text-foreground"
				}`}
			>
				{label}
			</span>
			<div />
			<span
				className={`text-xs leading-4 line-clamp-1 transition-opacity ${
					showDetail && detail ? "opacity-100" : "opacity-0"
				} ${status === "error" ? "text-status-error" : "text-muted-foreground"}`}
				aria-hidden={!showDetail || !detail}
			>
				{detail ?? "\u00A0"}
			</span>
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
