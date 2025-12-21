"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmQueueActionDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
	actionType: "cancel" | "forceUnlock" | "delete" | "deleteByState";
	isLoading?: boolean;
	jobCount?: number | undefined;
}

const dialogConfig = {
	cancel: {
		title: "Cancel Job",
		description: "Are you sure you want to cancel this job?",
		actionLabel: "Cancel Job",
	},
	forceUnlock: {
		title: "Force Unlock",
		description:
			"Force unlock is a destructive operation. This will forcefully release the job lock. Are you sure you want to continue?",
		actionLabel: "Force Unlock",
		isDestructive: true,
	},
	delete: {
		title: "Delete Job",
		description:
			"This will permanently delete this job from the queue. This action cannot be undone.",
		actionLabel: "Delete Job",
		isDestructive: true,
	},
	deleteByState: {
		title: "Delete Jobs",
		description:
			"This will permanently delete all matching jobs from the queue. This action cannot be undone.",
		actionLabel: "Delete Jobs",
		isDestructive: true,
	},
};

export function ConfirmQueueActionDialog({
	isOpen,
	onOpenChange,
	onConfirm,
	actionType,
	isLoading = false,
	jobCount = 1,
}: ConfirmQueueActionDialogProps) {
	const config = dialogConfig[actionType];
	const isDestructive =
		actionType === "forceUnlock" ||
		actionType === "delete" ||
		actionType === "deleteByState";

	const handleConfirm = async () => {
		try {
			await onConfirm();
			onOpenChange(false);
		} catch (err) {
			// Error is handled by the parent component
			console.error("Action failed:", err);
		}
	};

	return (
		<AlertDialog open={isOpen} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle
						className={`flex items-center gap-2 ${
							isDestructive ? "text-destructive" : ""
						}`}
					>
						{isDestructive && <AlertTriangle className="h-5 w-5" />}
						{config.title}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{config.description}
						{(actionType === "deleteByState" || actionType === "delete") &&
							jobCount > 1 && (
								<div className="mt-2 font-semibold">
									This will delete {jobCount} job{jobCount !== 1 ? "s" : ""}.
								</div>
							)}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						disabled={isLoading}
						variant={isDestructive ? "destructive" : "default"}
					>
						{isLoading ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								{config.actionLabel}...
							</>
						) : (
							config.actionLabel
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
