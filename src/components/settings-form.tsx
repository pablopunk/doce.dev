"use client";

import { useState, useEffect } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AIModel {
	id: string;
	name: string;
	provider: string;
	description: string;
}

export function SettingsForm() {
	const [currentModel, setCurrentModel] = useState<string>("");
	const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saveStatus, setSaveStatus] = useState<{
		message: string;
		type: "success" | "error" | "";
	}>({ message: "", type: "" });

	useEffect(() => {
		loadSettings();
	}, []);

	const loadSettings = async () => {
		try {
			const res = await fetch("/api/config/model");
			const data = await res.json();
			setCurrentModel(data.currentModel);
			setAvailableModels(data.availableModels);
		} catch (err) {
			console.error("Failed to load settings:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async () => {
		setSaving(true);
		setSaveStatus({ message: "", type: "" });

		try {
			const res = await fetch("/api/config/model", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model: currentModel }),
			});

			if (res.ok) {
				setSaveStatus({ message: "Saved!", type: "success" });
				setTimeout(() => {
					setSaveStatus({ message: "", type: "" });
				}, 2000);
			} else {
				throw new Error("Failed to save");
			}
		} catch (err) {
			setSaveStatus({ message: "Failed to save", type: "error" });
			setTimeout(() => {
				setSaveStatus({ message: "", type: "" });
			}, 2000);
		} finally {
			setSaving(false);
		}
	};

	const currentModelInfo = availableModels.find((m) => m.id === currentModel);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="max-w-md space-y-2">
				<Label htmlFor="model-select">Default Model</Label>
				<Select value={currentModel} onValueChange={setCurrentModel}>
					<SelectTrigger id="model-select" className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{availableModels.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.name} - {model.provider}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{currentModelInfo && (
					<p className="text-xs text-muted-foreground">
						{currentModelInfo.description}
					</p>
				)}
			</div>
			<div className="flex items-center gap-3">
				<Button onClick={handleSave} disabled={saving}>
					{saving ? "Saving..." : "Save Changes"}
				</Button>
				{saveStatus.message && (
					<p
						className={`text-sm ${
							saveStatus.type === "success"
								? "text-green-600"
								: "text-destructive"
						}`}
					>
						{saveStatus.message}
					</p>
				)}
			</div>
		</div>
	);
}
