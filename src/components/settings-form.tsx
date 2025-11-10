"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack";
import { Google } from "@/components/ui/svgs/google";
import { GrokDark } from "@/components/ui/svgs/grokDark";
import { KimiIcon } from "@/components/ui/svgs/kimiIcon";
import { Openai } from "@/components/ui/svgs/openai";

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
	const [popoverOpen, setPopoverOpen] = useState(false);
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

	const handleModelChange = async (modelId: string) => {
		setSaveStatus({ message: "", type: "" });
		setPopoverOpen(false);

		try {
			const res = await fetch("/api/config/model", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model: modelId }),
			});

			if (res.ok) {
				setCurrentModel(modelId);
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
		}
	};

	const getProviderIcon = (provider: string) => {
		const iconClass =
			"h-5 w-5 [&_*]:!fill-fg-secondary/60 [&_path]:!fill-fg-secondary/60";
		switch (provider) {
			case "OpenAI":
				return <Openai className={iconClass} />;
			case "Anthropic":
				return <AnthropicBlack className={iconClass} />;
			case "Google":
				return <Google className={iconClass} />;
			case "xAI":
				return <GrokDark className={iconClass} />;
			case "MoonshotAI":
				return <KimiIcon className={iconClass} />;
			default:
				return null;
		}
	};

	const currentModelInfo = availableModels.find((m) => m.id === currentModel);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="h-6 w-6 animate-spin rounded-full border-2 border-strong border-t-transparent"></div>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className="w-full justify-between h-auto py-3 bg-raised"
					>
						<div className="flex items-center gap-3">
							{currentModelInfo && getProviderIcon(currentModelInfo.provider)}
							<span className="text-left">
								{currentModelInfo ? (
									<>
										<span className="font-medium">{currentModelInfo.name}</span>
										<span className="text-muted">
											{" "}
											— {currentModelInfo.provider}
										</span>
									</>
								) : (
									"Select a model"
								)}
							</span>
						</div>
						<ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[32rem] p-3" align="start">
					<div className="space-y-1">
						{availableModels.map((model) => (
							<button
								key={model.id}
								onClick={() => handleModelChange(model.id)}
								className="flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-raised/90"
							>
								<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
									{getProviderIcon(model.provider)}
								</div>
								<div className="flex-1 space-y-0.5">
									<div className="flex items-center gap-2">
										{currentModel === model.id && (
											<Check className="h-3.5 w-3.5 text-strong" />
										)}
										<span className="text-sm font-medium">{model.name}</span>
										<span className="text-xs text-muted">
											{model.provider}
										</span>
									</div>
									<p className="text-xs text-muted">
										{model.description}
									</p>
								</div>
							</button>
						))}
					</div>
				</PopoverContent>
			</Popover>

			{currentModelInfo && (
				<p className="text-xs text-muted">
					{currentModelInfo.description}
				</p>
			)}

			{saveStatus.message && (
				<p
					className={`text-sm ${
						saveStatus.type === "success"
							? "text-strong text-strong"
							: "text-danger"
					}`}
				>
					{saveStatus.message}
				</p>
			)}
		</div>
	);
}
