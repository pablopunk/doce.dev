"use client";

import { actions } from "astro:actions";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEventSource } from "@/hooks/useEventSource";

const CONFIRMATION_TEXT = "delete all projects";

export function DeleteAllProjectsSection() {
	const [projectCount, setProjectCount] = useState<number | null>(null);

	const fetchCount = useCallback(async () => {
		try {
			const result = await actions.projects.list();
			setProjectCount(result.data?.projects.length ?? 0);
		} catch {
			setProjectCount(0);
		}
	}, []);

	useEffect(() => {
		fetchCount();
	}, [fetchCount]);
	const [isOpen, setIsOpen] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
	const confirmInputRef = useRef<HTMLInputElement>(null);

	const isConfirmed = confirmText.toLowerCase() === CONFIRMATION_TEXT;

	const handleDelete = async () => {
		if (!isConfirmed) return;

		setIsDeleting(true);

		try {
			const result = await actions.projects.deleteAll();
			const jobId = result.data?.jobId;
			if (!result.data?.success || !jobId) {
				throw new Error("Failed to delete projects");
			}

			setDeleteJobId(jobId);
			toast.success(
				`Deletion scheduled (job ${jobId}). Monitor progress in Settings > Status.`,
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to delete projects",
			);
		} finally {
			setIsDeleting(false);
		}
	};

	useEventSource({
		enabled: Boolean(deleteJobId),
		url: deleteJobId ? `/api/queue/job-stream?jobId=${deleteJobId}` : null,
		listeners: {
			message: (event) => {
				try {
					const data = JSON.parse(event.data) as {
						job?: { state: string; lastError?: string | null };
					};
					const state = data.job?.state;

					if (state === "succeeded") {
						toast.success("All projects deleted successfully.");
						window.location.reload();
					}

					if (state === "failed" || state === "cancelled") {
						toast.error(data.job?.lastError || `Deletion job ${state}`);
						setDeleteJobId(null);
					}
				} catch {
					// ignore malformed events
				}
			},
		},
	});

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setConfirmText("");
			setDeleteJobId(null);
		} else {
			// Auto-focus confirmation input when dialog opens
			setTimeout(() => {
				confirmInputRef.current?.focus();
			}, 0);
		}
	};

	if (projectCount === null) {
		return null;
	}

	if (projectCount === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-destructive">Danger Zone</CardTitle>
					<CardDescription>
						Irreversible and destructive actions.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground">
						You don't have any projects to delete.
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="border-destructive/50">
			<CardHeader>
				<CardTitle className="text-destructive flex items-center gap-2">
					<AlertTriangle className="h-5 w-5" />
					Danger Zone
				</CardTitle>
				<CardDescription>Irreversible and destructive actions.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium">Delete all projects</p>
						<p className="text-sm text-muted-foreground">
							This will permanently delete all {projectCount} project(s),
							including their Docker containers, volumes, and files.
						</p>
					</div>
					<Dialog open={isOpen} onOpenChange={handleOpenChange}>
						<DialogTrigger
							render={
								<Button variant="destructive">
									<Trash2 className="h-4 w-4" />
									Delete All
								</Button>
							}
						/>
						<DialogContent>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2 text-destructive">
									<AlertTriangle className="h-5 w-5" />
									Delete All Projects
								</DialogTitle>
								<DialogDescription>
									This action cannot be undone. This will permanently delete all{" "}
									{projectCount} project(s), including:
								</DialogDescription>
							</DialogHeader>

							<ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
								<li>All Docker containers and volumes</li>
								<li>All project files and directories</li>
								<li>All database records</li>
							</ul>

							<div className="space-y-2">
								<Label htmlFor="confirm-text">
									Type{" "}
									<code className="bg-muted px-1 py-0.5 rounded text-sm">
										{CONFIRMATION_TEXT}
									</code>{" "}
									to confirm:
								</Label>
								<Input
									ref={confirmInputRef}
									id="confirm-text"
									value={confirmText}
									onChange={(e) => setConfirmText(e.target.value)}
									placeholder={CONFIRMATION_TEXT}
									disabled={isDeleting}
									autoComplete="off"
									title="Type 'delete all projects' to confirm this action"
								/>
							</div>

							<DialogFooter>
								<DialogClose
									render={
										<Button variant="outline" disabled={isDeleting}>
											Cancel
										</Button>
									}
								/>
								<Button
									variant="destructive"
									onClick={handleDelete}
									disabled={!isConfirmed || isDeleting}
								>
									{isDeleting ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" />
											Deleting...
										</>
									) : (
										<>
											<Trash2 className="h-4 w-4" />
											Delete All Projects
										</>
									)}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>
			</CardContent>
		</Card>
	);
}
