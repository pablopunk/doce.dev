"use client";

import { actions } from "astro:actions";
import { Check, Loader2, Settings2, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import AIBlob from "@/components/ui/ai-blob";
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
		"anthropic/claude-sonnet-4.5",
	);
	const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [hasApiKey, setHasApiKey] = useState(true);
	const [checkingKeys, setCheckingKeys] = useState(true);

	// Load current model and available models on mount
	useEffect(() => {
		Promise.all([actions.config.getModel(), actions.config.getApiKeys()])
			.then(([modelResult, keysResult]) => {
				if (!modelResult.error && modelResult.data) {
					setCurrentModel(modelResult.data.currentModel);
					setAvailableModels(modelResult.data.availableModels);
				}
				if (!keysResult.error && keysResult.data) {
					const hasAnyKey = Object.values(keysResult.data.keys).some(
						(v) => v === true,
					);
					setHasApiKey(hasAnyKey);
				}
			})
			.catch((err) => console.error("Failed to load config:", err))
			.finally(() => setCheckingKeys(false));
	}, []);

	const create = async () => {
		const prompt = value.trim();
		if (!prompt) return;
		setLoading(true);
		try {
			const { data: project, error } = await actions.projects.createProject({
				prompt: prompt, // AI will generate the name and description
			});
			if (error) throw error;
			if (typeof window !== "undefined" && project) {
				// Redirect immediately - chat interface will handle generation
				window.location.assign(`/project/${project.id}`);
			}
		} catch (err) {
			console.error(err);
			setLoading(false);
		}
		// Don't set loading to false on success since we're redirecting
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			create();
		}
	};

	const handleModelChange = async (modelId: string) => {
		try {
			const { error } = await actions.config.setModel({ model: modelId });
			if (!error) {
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
						className="bg-gradient-to-r from-purple-400 via-pink-400 via-blue-400 to-cyan-400 bg-clip-text font-medium text-transparent"
					>
						{loading ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin text-fg text-yellow-500 dark:text-yellow-300" />
								Creating...
							</>
						) : (
							<>
								<Sparkles className="h-4 w-4 text-yellow-500 dark:text-yellow-300" />
								Create
							</>
						)}
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</div>
	);
}
