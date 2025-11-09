"use client";

import { ArrowUpRight, Check, Plus, Settings2 } from "lucide-react";
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

	// Load current model and available models on mount
	useEffect(() => {
		fetch("/api/config/model")
			.then((res) => res.json())
			.then((data) => {
				setCurrentModel(data.currentModel);
				setAvailableModels(data.availableModels);
			})
			.catch((err) => console.error("Failed to load model config:", err));
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
				? "h-4 w-4 [&_*]:!fill-muted-foreground [&_path]:!fill-muted-foreground"
				: "h-5 w-5 [&_*]:!fill-muted-foreground/60 [&_path]:!fill-muted-foreground/60";
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
			{loading && (
				<div className="mb-8 flex flex-col items-center justify-center gap-6">
					{/* Siri-inspired orb animation */}
					<div className="relative flex h-32 w-32 items-center justify-center">
						{/* Outer glow rings */}
						<div className="absolute inset-0 animate-[ping_2s_ease-in-out_infinite]">
							<div className="h-full w-full rounded-full bg-gradient-to-r from-purple-500/30 via-pink-500/30 to-blue-500/30 blur-xl" />
						</div>
						<div className="absolute inset-0 animate-[ping_2s_ease-in-out_infinite_0.5s]">
							<div className="h-full w-full rounded-full bg-gradient-to-r from-blue-500/30 via-cyan-500/30 to-purple-500/30 blur-xl" />
						</div>

						{/* Main orb with animated gradient */}
						<div className="relative h-24 w-24 overflow-hidden rounded-full">
							<div className="absolute inset-0 animate-[spin_3s_linear_infinite] bg-gradient-conic from-purple-600 via-pink-600 via-blue-600 via-cyan-600 to-purple-600" />
							<div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-purple-900/90 via-blue-900/90 to-pink-900/90 backdrop-blur-xl animate-[pulse_3s_ease-in-out_infinite]" />

							{/* Inner animated waves */}
							<div className="absolute inset-0 animate-[pulse_1.5s_ease-in-out_infinite]">
								<div className="h-full w-full rounded-full bg-gradient-to-r from-purple-400/40 via-pink-400/40 to-blue-400/40 blur-md" />
							</div>
							<div className="absolute inset-0 animate-[pulse_1.5s_ease-in-out_infinite_0.3s]">
								<div className="h-full w-full rounded-full bg-gradient-to-r from-cyan-400/40 via-blue-400/40 to-purple-400/40 blur-md" />
							</div>
						</div>

						{/* Orbiting particles */}
						<div className="absolute inset-0 animate-[spin_4s_linear_infinite]">
							<div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
						</div>
						<div className="absolute inset-0 animate-[spin_4s_linear_infinite_1s]">
							<div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.8)]" />
						</div>
						<div className="absolute inset-0 animate-[spin_4s_linear_infinite_2s]">
							<div className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
						</div>
					</div>

					{/* Text with animated gradient */}
					<div className="space-y-2 text-center">
						<div className="relative">
							<div className="bg-gradient-to-r from-purple-400 via-pink-400 via-blue-400 to-cyan-400 bg-clip-text text-lg font-medium text-transparent animate-[pulse_2s_ease-in-out_infinite]">
								AI is generating your project...
							</div>
						</div>
						<div className="text-sm text-muted-foreground/60">
							This may take a moment
						</div>
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
									<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										AI Model
									</Label>
									{currentModelInfo && (
										<p className="mt-1 text-xs text-muted-foreground">
											Currently using: {currentModelInfo.name}
										</p>
									)}
								</div>
								<Separator />
								<div className="space-y-1">
									{availableModels.map((model) => (
										<button
											key={model.id}
											onClick={() => handleModelChange(model.id)}
											className="flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent"
										>
											<div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
												{getProviderIcon(model.provider)}
											</div>
											<div className="flex-1 space-y-0.5">
												<div className="flex items-center gap-2">
													{currentModel === model.id && (
														<Check className="h-3.5 w-3.5 text-primary" />
													)}
													<span className="text-sm font-medium">
														{model.name}
													</span>
													<span className="text-xs text-muted-foreground">
														{model.provider}
													</span>
												</div>
												<p className="text-xs text-muted-foreground">
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
					placeholder="Describe what to build..."
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={onKeyDown}
					className="h-14 text-base outline-none"
					disabled={loading}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						aria-label="Create"
						size="icon-sm"
						variant="ghost"
						onClick={create}
						disabled={loading || !value.trim()}
					>
						<ArrowUpRight className="size-5" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</div>
	);
}
