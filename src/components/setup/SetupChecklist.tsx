import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckRow, type CheckStatus } from "./CheckRow";

export interface ChecklistItem {
	id: string;
	label: string;
	status: CheckStatus;
	detail?: string | undefined;
}

interface SetupChecklistProps {
	heading: string;
	items: ChecklistItem[];
	footerNote?: string | undefined;
	error?: {
		message: string;
		onRetry?: () => void;
		retrying?: boolean;
		retryLabel?: string;
	} | null;
	fatalError?: string | null;
}

export function SetupChecklist({
	heading,
	items,
	footerNote,
	error,
	fatalError,
}: SetupChecklistProps) {
	if (fatalError) {
		return (
			<Shell>
				<h2 className="text-2xl font-semibold text-center">
					Failed to Start Environment
				</h2>
				<FatalError message={fatalError} />
			</Shell>
		);
	}

	return (
		<Shell>
			<h2 className="text-2xl font-semibold text-center">{heading}</h2>

			<div className="flex flex-col gap-1 w-full max-w-sm mx-auto">
				{items.map((item) => (
					<CheckRow
						key={item.id}
						label={item.label}
						status={item.status}
						detail={item.detail}
					/>
				))}
			</div>

			{footerNote ? (
				<p className="text-xs text-muted-foreground text-center">
					{footerNote}
				</p>
			) : null}

			{error ? (
				<div className="space-y-3 w-full max-w-sm mx-auto">
					<div className="p-3 bg-status-error-light border border-status-error rounded-lg">
						<p className="text-sm text-status-error break-words">
							<span className="font-semibold">Error: </span>
							{error.message}
						</p>
					</div>
					{error.onRetry ? (
						<div className="flex justify-center">
							<Button
								onClick={error.onRetry}
								variant="outline"
								disabled={error.retrying}
							>
								{error.retrying ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Retrying...
									</>
								) : (
									(error.retryLabel ?? "Retry")
								)}
							</Button>
						</div>
					) : null}
				</div>
			) : null}
		</Shell>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex-1 flex items-center justify-center px-4">
			<div className="flex flex-col items-stretch gap-6 w-full max-w-2xl">
				{children}
			</div>
		</div>
	);
}

function FatalError({ message }: { message: string }) {
	return (
		<div className="space-y-4 w-full max-w-sm mx-auto">
			<div className="flex justify-center">
				<AlertTriangle className="h-12 w-12 text-status-error" />
			</div>
			<div className="p-4 bg-status-error-light border border-status-error rounded-lg text-left">
				<p className="text-sm text-status-error break-words">
					<span className="font-semibold">Error: </span>
					{message}
				</p>
			</div>
			<div className="flex justify-center">
				<Button onClick={() => window.location.reload()} variant="outline">
					Retry Startup
				</Button>
			</div>
		</div>
	);
}
