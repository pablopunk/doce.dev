"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
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

interface ConfirmStopAllDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
	isLoading?: boolean;
}

export function ConfirmStopAllDialog({
	isOpen,
	onOpenChange,
	onConfirm,
	isLoading = false,
}: ConfirmStopAllDialogProps) {
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
					<AlertDialogTitle className="flex items-center gap-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						Stop All Projects
					</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to stop all projects? This will terminate all
						running development and production containers.
					</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleConfirm}
						disabled={isLoading}
						variant="destructive"
					>
						{isLoading ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Stopping...
							</>
						) : (
							"Stop All Projects"
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
