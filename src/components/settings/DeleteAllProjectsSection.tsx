"use client";

import { useEffect, useState, useRef } from "react";
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
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

const CONFIRMATION_TEXT = "delete all projects";

interface DeleteAllProjectsSectionProps {
	projectCount: number;
}

export function DeleteAllProjectsSection({
	projectCount,
}: DeleteAllProjectsSectionProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const [result, setResult] = useState<{
		success: boolean;
		message: string;
	} | null>(null);
	const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
	const confirmInputRef = useRef<HTMLInputElement>(null);

	const isConfirmed = confirmText.toLowerCase() === CONFIRMATION_TEXT;

	const handleDelete = async () => {
		if (!isConfirmed) return;

		setIsDeleting(true);
		setResult(null);

		try {
			const response = await fetch("/_actions/projects.deleteAll", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});

			const data = await response.json();
			// Astro Actions return [data, ok, error] format
			const resultData = Array.isArray(data) ? data[0] : data.data;

			if (resultData?.success) {
				const jobId = resultData.jobId as string | undefined;
				if (!jobId) {
					throw new Error("Missing jobId from server");
				}

				setDeleteJobId(jobId);
				setResult({
					success: true,
					message: `Deletion scheduled (job ${jobId}). Monitor progress in /queue.`,
				});
			} else {
				throw new Error("Failed to delete projects");
			}
		} catch (error) {
			setResult({
				success: false,
				message:
					error instanceof Error ? error.message : "Failed to delete projects",
			});
		} finally {
			setIsDeleting(false);
		}
	};

	useEffect(() => {
		if (!deleteJobId) return;

		let isCancelled = false;

		const interval = setInterval(async () => {
			if (isCancelled) return;

			try {
				const res = await fetch(`/api/queue/jobs/${deleteJobId}`);
				if (!res.ok) return;

				const data = (await res.json()) as {
					job?: { state: string; lastError?: string | null };
				};

				const state = data.job?.state;

				if (state === "succeeded") {
					window.location.reload();
				}

				if (state === "failed" || state === "cancelled") {
					setResult({
						success: false,
						message: data.job?.lastError || `Deletion job ${state}`,
					});
					setDeleteJobId(null);
				}
			} catch {
				// ignore
			}
		}, 2000);

		return () => {
			isCancelled = true;
			clearInterval(interval);
		};
	}, [deleteJobId]);

	const handleOpenChange = (open: boolean) => {
		setIsOpen(open);
		if (!open) {
			setConfirmText("");
			setResult(null);
			setDeleteJobId(null);
		} else {
			// Auto-focus confirmation input when dialog opens
			setTimeout(() => {
				confirmInputRef.current?.focus();
			}, 0);
		}
	};

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
						<DialogTrigger asChild>
							<Button variant="destructive">
								<Trash2 className="h-4 w-4" />
								Delete All
							</Button>
						</DialogTrigger>
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

							{result && (
								<div
									className={`rounded-md p-3 text-sm ${
										result.success
											? "bg-green-500/10 text-green-600 dark:text-green-400"
											: "bg-destructive/10 text-destructive"
									}`}
								>
									{result.message}
								</div>
							)}

							<DialogFooter>
								<DialogClose asChild>
									<Button variant="outline" disabled={isDeleting}>
										Cancel
									</Button>
								</DialogClose>
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
