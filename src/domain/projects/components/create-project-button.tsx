"use client";

import { actions } from "astro:actions";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateProjectButton() {
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [loading, setLoading] = useState(false);
	const [hasApiKey, setHasApiKey] = useState(true);
	const [checkingKeys, setCheckingKeys] = useState(true);

	useEffect(() => {
		actions.config
			.getApiKeys()
			.then(({ data, error }) => {
				if (!error && data) {
					const hasAnyKey = Object.values(data.keys).some((v) => v === true);
					setHasApiKey(hasAnyKey);
				}
			})
			.catch((err) => console.error("Failed to load API keys:", err))
			.finally(() => setCheckingKeys(false));
	}, []);

	const handleCreate = async () => {
		if (!name.trim()) return;

		setLoading(true);
		try {
			const { data: project, error } = await actions.projects.createProject({
				name,
				description,
			});

			if (error) {
				throw new Error("Failed to create project");
			}

			if (typeof window !== "undefined" && project) {
				window.location.assign(`/project/${project.id}`);
			}
		} catch (error) {
			console.error("Failed to create project:", error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					className="flex items-center gap-2"
					disabled={!hasApiKey && !checkingKeys}
				>
					<Plus className="h-4 w-4" />
					New Project
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New Project</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 py-4">
					{!hasApiKey && !checkingKeys && (
						<div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
							<p className="font-medium text-warning text-warning">
								No API key configured
							</p>
							<p className="text-warning/80 text-warning/80 mt-1">
								Please configure an API key in{" "}
								<a href="/settings" className="underline hover:no-underline">
									Settings
								</a>{" "}
								to create projects.
							</p>
						</div>
					)}
					<div className="space-y-2">
						<Label htmlFor="name">Project Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="My Awesome Website"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="description">Description (optional)</Label>
						<Textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="A brief description of your project"
						/>
					</div>
					<Button
						onClick={handleCreate}
						disabled={loading || !name.trim() || !hasApiKey}
						className="w-full"
					>
						{loading ? "Creating..." : "Create Project"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
