"use client";

import {
	Brain,
	CameraOff,
	Check,
	ChevronsUpDown,
	Lock,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack";
import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite";
import { Gemini } from "@/components/ui/svgs/gemini";
import { Minimax } from "@/components/ui/svgs/minimax";
import { MinimaxDark } from "@/components/ui/svgs/minimaxDark";
import { Openai } from "@/components/ui/svgs/openai";
import { OpenaiDark } from "@/components/ui/svgs/openaiDark";
import { ZaiDark } from "@/components/ui/svgs/zaiDark";
import { ZaiLight } from "@/components/ui/svgs/zaiLight";
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const VENDOR_LOGOS: Record<
	string,
	{ light: React.ComponentType<any>; dark: React.ComponentType<any> }
> = {
	openai: { light: Openai, dark: OpenaiDark },
	anthropic: { light: AnthropicBlack, dark: AnthropicWhite },
	google: { light: Gemini, dark: Gemini },
	"z.ai": { light: ZaiLight, dark: ZaiDark },
	minimax: { light: Minimax, dark: MinimaxDark },
};

interface ModelSelectorProps {
	models: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		vendor: string;
		description?: string;
		tier?: "fast" | "top";
		supportsImages?: boolean;
		available?: boolean;
		unavailableReason?: string;
	}>;
	selectedModelId: string;
	onModelChange: (modelId: string) => void;
}

function getTierIcon(tier?: string) {
	if (tier === "fast")
		return <Zap className="w-3.5 h-3.5 text-muted-foreground" />;
	if (tier === "top")
		return <Brain className="w-3.5 h-3.5 text-muted-foreground" />;
	return null;
}

function getImageSupportIcon(supportsImages?: boolean) {
	if (supportsImages === false) {
		return <CameraOff className="w-3.5 h-3.5 text-muted-foreground" />;
	}
	return null;
}

/**
 * Generate a unique composite key for a model that includes both provider and model ID.
 * This ensures that the same model from different providers is treated as separate options.
 * E.g., "opencode:openai/gpt-5.2" vs "openrouter:openai/gpt-5.2"
 */
function getModelKey(provider: string, id: string): string {
	return `${provider}:${id}`;
}

export function ModelSelector({
	models,
	selectedModelId,
	onModelChange,
}: ModelSelectorProps) {
	const [theme, setTheme] = useState<"light" | "dark">("light");
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const isDark = document.documentElement.classList.contains("dark");
		setTheme(isDark ? "dark" : "light");

		const observer = new MutationObserver(() => {
			const isDark = document.documentElement.classList.contains("dark");
			setTheme(isDark ? "dark" : "light");
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	// Find selected model or fallback to first available model
	// selectedModelId is now a composite key: "provider:modelId"
	const selectedModel =
		models.find((m) => getModelKey(m.provider, m.id) === selectedModelId) ||
		models[0];

	// Auto-select first model if current selection is invalid
	useEffect(() => {
		if (!selectedModel && models.length > 0) {
			onModelChange(getModelKey(models[0]!.provider, models[0]!.id));
		}
	}, [models, selectedModel, onModelChange]);

	const vendorLogo = selectedModel
		? VENDOR_LOGOS[selectedModel.vendor.toLowerCase()]
		: null;

	const renderLogo = (logoVariants: typeof vendorLogo) => {
		if (!logoVariants) return null;
		const Logo = theme === "dark" ? logoVariants.dark : logoVariants.light;
		return <Logo className="w-full h-full" />;
	};

	const grouped = Array.from(
		models.reduce((acc, model) => {
			const provider = model.provider;
			if (!acc.has(provider)) {
				acc.set(provider, []);
			}
			const group = acc.get(provider);
			if (group) {
				group.push(model);
			}
			return acc;
		}, new Map<string, Array<(typeof models)[number]>>()),
	).sort((a, b) => a[0].localeCompare(b[0]));

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				className={cn(
					"focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground bg-clip-padding text-sm font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-between w-full max-w-[200px] whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none h-8 gap-1.5 px-2.5",
				)}
				role="combobox"
				aria-expanded={open}
			>
				<span className="flex items-center gap-2 flex-1 truncate">
					{vendorLogo && (
						<div className="w-4 h-4 shrink-0">{renderLogo(vendorLogo)}</div>
					)}
					<span className="truncate">
						{selectedModel?.name || "Select model"}
					</span>
					{selectedModel && getTierIcon(selectedModel.tier)}
					{selectedModel && getImageSupportIcon(selectedModel.supportsImages)}
				</span>
				<ChevronsUpDown className="opacity-50 size-4 shrink-0" />
			</PopoverTrigger>
			<PopoverContent className="w-full p-0">
				<Command>
					<CommandInput placeholder="Search models..." />
					<CommandList>
						<CommandEmpty>No model found.</CommandEmpty>
						{grouped.map(([provider, providerModels]) => (
							<CommandGroup key={provider} heading={provider}>
								{providerModels.map((model) => {
									const isAvailable = model.available !== false;
									const modelVendorLogo =
										VENDOR_LOGOS[model.vendor.toLowerCase()];
									const modelKey = getModelKey(model.provider, model.id);
									const item = (
										<CommandItem
											key={modelKey}
											value={`${model.id} ${model.name} ${provider} ${model.vendor}`}
											disabled={!isAvailable}
											onSelect={() => {
												onModelChange(modelKey);
												setOpen(false);
											}}
											className={`flex items-center gap-2 ${
												!isAvailable ? "opacity-50" : ""
											}`}
										>
											{modelVendorLogo && (
												<div className="w-4 h-4 shrink-0">
													{renderLogo(modelVendorLogo)}
												</div>
											)}
											<span className="flex-1 truncate">{model.name}</span>
											{getTierIcon(model.tier)}
											{getImageSupportIcon(model.supportsImages)}
											{!isAvailable && (
												<Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
											)}
											<Check
												className={cn(
													"ml-auto size-4 shrink-0",
													selectedModelId === modelKey
														? "opacity-100"
														: "opacity-0",
												)}
											/>
										</CommandItem>
									);

									if (!isAvailable && model.unavailableReason) {
										return (
											<Tooltip key={modelKey}>
												<TooltipContent side="right">
													{model.unavailableReason}
												</TooltipContent>
												{item}
											</Tooltip>
										);
									}

									return item;
								})}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
