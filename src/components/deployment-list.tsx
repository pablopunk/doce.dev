"use client";

import { CheckCircle, ExternalLink, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function DeploymentList({ projectId }: { projectId: string }) {
	const { data, mutate } = useSWR(
		`/api/projects/${projectId}/deploy`,
		fetcher,
		{ refreshInterval: 5000 },
	);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [deploymentToDelete, setDeploymentToDelete] = useState<string | null>(
		null,
	);

	const handleDeleteClick = (deploymentId: string) => {
		setDeploymentToDelete(deploymentId);
		setDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = async () => {
		if (deploymentToDelete) {
			await fetch(`/api/deployments/${deploymentToDelete}`, {
				method: "DELETE",
			});
			mutate();
		}
		setDeleteDialogOpen(false);
		setDeploymentToDelete(null);
	};

	if (!data?.deployments) {
		return null;
	}

	return (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold">Deployments</h3>
			{data.deployments.length === 0 ? (
				<p className="text-sm text-secondary-foreground">No deployments yet</p>
			) : (
				<div className="space-y-2">
					{data.deployments.map((deployment: any) => (
						<Card key={deployment.id} className="p-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									{deployment.status === "running" ? (
										<CheckCircle className="h-5 w-5 text-green-500" />
									) : (
										<XCircle className="h-5 w-5 text-secondary-foreground" />
									)}
									<div>
										<div className="font-mono text-sm">{deployment.url}</div>
										<div className="text-xs text-secondary-foreground">
											{new Date(deployment.created_at).toLocaleString()}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Button asChild variant="outline" size="sm">
										<a
											href={deployment.url}
											target="_blank"
											rel="noopener noreferrer"
										>
											<ExternalLink className="h-4 w-4" />
										</a>
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => handleDeleteClick(deployment.id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</Card>
					))}
				</div>
			)}

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Stop Deployment</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to stop this deployment? This action cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className={cn(buttonVariants({ variant: "destructive" }))}
							onClick={handleDeleteConfirm}
						>
							Stop
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
