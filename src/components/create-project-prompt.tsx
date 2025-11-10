"use client";

import { Sparkles, Check, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack";
import { Google } from "@/components/ui/svgs/google";
import { GrokDark } from "@/components/ui/svgs/grokDark";
import { KimiIcon } from "@/components/ui/svgs/kimiIcon";
import { Openai } from "@/components/ui/svgs/openai";
import AIBlob from "./ui/ai-blob";

interface ModelInfo {
	id: string;
	name: string;
	provider: string;
	description: string;
}

export function CreateProjectPrompt() {
	const [value, setValue] = useState("");
	const [loading, setLoading] = useState(false);
	const [currentModel, setCurrentModel] = useState<string>(
		"openai/gpt-4.1-mini",
	);
	const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [hasApiKey, setHasApiKey] = useState(true);
	const [checkingKeys, setCheckingKeys] = useState(true);

	// Load current model and available models on mount
	useEffect(() => {
		Promise.all([
			fetch("/api/config/model").then((res) => res.json()),
			fetch("/api/config/api-keys").then((res) => res.json()),
		])
			.then(([modelData, keysData]) => {
				setCurrentModel(modelData.currentModel);
				setAvailableModels(modelData.availableModels);
				const hasAnyKey = Object.values(keysData.keys).some((v) => v === true);
				setHasApiKey(hasAnyKey);
			})
			.catch((err) => console.error("Failed to load config:", err))
			.finally(() => setCheckingKeys(false));
	}, []);

	const create = async () => {
		const prompt = value.trim();
		if (!prompt) return;
		setLoading(true);
		try {
			const res = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					prompt: prompt, // AI will generate the name and description
				}),
			});
			if (!res.ok) throw new Error("Failed to create project");
			const project = await res.json();
			if (typeof window !== "undefined") {
				window.location.assign(`/project/${project.id}`);
			}
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			create();
		}
	};

	const handleModelChange = async (modelId: string) => {
		try {
			const res = await fetch("/api/config/model", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ model: modelId }),
			});
			if (res.ok) {
				setCurrentModel(modelId);
				setPopoverOpen(false);
			}
		} catch (err) {
			console.error("Failed to update model:", err);
		}
	};

	const currentModelInfo = availableModels.find((m) => m.id === currentModel);

	const getProviderIcon = (provider: string, size: "sm" | "md" = "md") => {
		const iconClass =
			size === "sm"
				? "h-4 w-4 [&_*]:!fill-fg-secondary [&_path]:!fill-fg-secondary"
				: "h-5 w-5 [&_*]:!fill-fg-secondary/60 [&_path]:!fill-fg-secondary/60";
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

	return (
		<div className="w-full max-w-3xl">
			{!hasApiKey && !checkingKeys && (
				<div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
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
			{loading && (
				<div className="mb-8 flex flex-col items-center justify-center gap-6">
					<AIBlob />

					<div className="space-y-2 text-center">
						<div className="relative">
							<div className="bg-gradient-to-r from-purple-400 via-pink-400 via-blue-400 to-cyan-400 bg-clip-text text-lg font-medium text-transparent animate-[pulse_2s_ease-in-out_infinite]">
								AI is generating your project...
							</div>
						</div>
						<div className="text-sm text-muted/60">This may take a moment</div>
					</div>
				</div>
			)}
			<InputGroup className="h-14">
				<InputGroupAddon>
					<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
						<PopoverTrigger asChild>
							<InputGroupButton
								aria-label="Options"
								size="icon-sm"
								variant="ghost"
							>
								{currentModelInfo ? (
									getProviderIcon(currentModelInfo.provider, "sm")
								) : (
									<Settings2 className="size-4" />
								)}
							</InputGroupButton>
						</PopoverTrigger>
						<PopoverContent className="w-[32rem] p-3" align="start">
							<div className="space-y-3">
								<div>
									<Label className="text-xs font-semibold uppercase tracking-wider text-muted">
										AI Model
									</Label>
									{currentModelInfo && (
										<p className="mt-1 text-xs text-muted">
											Currently using: {currentModelInfo.name}
										</p>
									)}
								</div>
								<Separator />
								<div className="space-y-1">
									{availableModels.map((model) => (
										<button
											key={model.id}
											type="button"
											onClick={() => handleModelChange(model.id)}
											className="flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-cta cursor-pointer"
										>
											<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
												{getProviderIcon(model.provider)}
											</div>
											<div className="flex-1 space-y-0.5">
												<div className="flex items-center gap-2">
													{currentModel === model.id && (
														<Check className="h-3.5 w-3.5 text-strong" />
													)}
													<span className="text-sm font-medium">
														{model.name}
													</span>
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
							</div>
						</PopoverContent>
					</Popover>
				</InputGroupAddon>
				<InputGroupInput
					placeholder={
						!hasApiKey && !checkingKeys
							? "Configure API key in Settings first..."
							: "Describe what to build..."
					}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={onKeyDown}
					className="text-base outline-none"
					disabled={loading || !hasApiKey}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						aria-label="Create"
						variant="default"
						size="sm"
						onClick={create}
						disabled={loading || !value.trim() || !hasApiKey}
					>
						<Sparkles className="size-5" />
						Create
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</div>
	);
}
