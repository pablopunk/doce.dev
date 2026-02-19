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
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import {
	getProviderLogo,
	getProviderMonogram,
	type ProviderLogoResult,
} from "@/lib/providerLogos";
import { cn } from "@/lib/utils";

function renderLogo(
	logo: ProviderLogoResult,
	theme: "light" | "dark",
	size?: string,
) {
	if (!logo) return null;

	if (logo.type === "svg") {
		const Component = theme === "dark" ? logo.dark : logo.light;
		return <Component className={size ?? "w-full h-full"} />;
	}

	return (
		<img
			src={logo.url}
			alt=""
			className={size ?? "w-full h-full"}
			style={{ objectFit: "contain" }}
		/>
	);
}

function renderMonogram(provider: string) {
	const letter = getProviderMonogram(provider);
	return (
		<div className="w-4 h-4 flex items-center justify-center bg-muted rounded text-[10px] font-medium">
			{letter}
		</div>
	);
}

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
	recentModels?: ReadonlyArray<string>;
	selectedModelId: string;
	onModelChange: (modelId: string) => void;
	triggerClassName?: string;
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

function getModelKey(provider: string, id: string): string {
	return `${provider}:${id}`;
}

export function ModelSelector({
	models,
	recentModels = [],
	selectedModelId,
	onModelChange,
	triggerClassName,
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

	const selectedModel =
		models.find((m) => getModelKey(m.provider, m.id) === selectedModelId) ||
		models[0];

	useEffect(() => {
		if (!selectedModel && models.length > 0) {
			const firstModel = models[0];
			if (firstModel) {
				onModelChange(getModelKey(firstModel.provider, firstModel.id));
			}
		}
	}, [models, selectedModel, onModelChange]);

	const vendorLogo = selectedModel
		? getProviderLogo(selectedModel.vendor, selectedModel.provider)
		: null;

	const recentModelKeys = recentModels.slice(0, 5);

	const recentSectionModels = models.filter((m) =>
		recentModelKeys.includes(getModelKey(m.provider, m.id)),
	);

	const grouped: Array<[string, Array<(typeof models)[number]>]> = Array.from(
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
	)
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([provider, providerModels]) => {
			const sortedModels = [...providerModels].sort((a, b) =>
				a.name.localeCompare(b.name, undefined, {
					numeric: true,
					sensitivity: "base",
				}),
			);

			return [provider, sortedModels];
		});

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				className={cn(
					"focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground bg-clip-padding text-sm font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-between w-full max-w-[200px] whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none h-8 gap-1.5 px-2.5",
					triggerClassName,
				)}
				role="combobox"
				aria-expanded={open}
			>
				<span className="flex items-center gap-2 flex-1 truncate">
					{vendorLogo ? (
						<div className="w-4 h-4 shrink-0">
							{renderLogo(vendorLogo, theme)}
						</div>
					) : selectedModel ? (
						renderMonogram(selectedModel.provider)
					) : null}
					<span className="truncate">
						{selectedModel?.name || "Select model"}
					</span>
					{selectedModel && getTierIcon(selectedModel.tier)}
					{selectedModel && getImageSupportIcon(selectedModel.supportsImages)}
				</span>
				<ChevronsUpDown className="opacity-50 size-4 shrink-0" />
			</PopoverTrigger>
			<PopoverContent className="w-full p-0">
				<Command
					filter={(value, search) => {
						const normalizedValue = value.toLowerCase();
						const normalizedSearch = search.toLowerCase().trim();

						if (normalizedSearch.length === 0) return 1;

						const searchWords = normalizedSearch.split(/\s+/);

						const allWordsMatch = searchWords.every((word) =>
							normalizedValue.includes(word),
						);

						if (!allWordsMatch) return 0;

						const valueWords = normalizedValue.split(/\s+|[-_/]/);
						let score = 1;

						for (const searchWord of searchWords) {
							for (const valueWord of valueWords) {
								if (valueWord === searchWord) {
									score += 10;
								} else if (valueWord.startsWith(searchWord)) {
									score += 5;
								} else if (valueWord.includes(searchWord)) {
									score += 2;
								}
							}
						}

						return score;
					}}
				>
					<CommandInput placeholder="Search models..." />
					<CommandList>
						<CommandEmpty>No model found.</CommandEmpty>
						{recentSectionModels.length > 0 && (
							<CommandGroup heading="Recent">
								{recentSectionModels.map((model) => {
									const modelKey = getModelKey(model.provider, model.id);
									const logo = getProviderLogo(model.vendor, model.provider);

									return (
										<CommandItem
											key={modelKey}
											value={model.name}
											onSelect={() => {
												onModelChange(modelKey);
												setOpen(false);
											}}
											className="flex items-center justify-between gap-2"
										>
											<div className="flex items-center gap-2 min-w-0">
												{logo ? (
													<div className="w-4 h-4 shrink-0">
														{renderLogo(logo, theme)}
													</div>
												) : (
													renderMonogram(model.provider)
												)}
												<span className="truncate">{model.name}</span>
											</div>
											<div className="flex items-center gap-2 shrink-0">
												<Check
													className={cn(
														"size-4 shrink-0",
														selectedModelId === modelKey
															? "opacity-100"
															: "opacity-0",
													)}
												/>
											</div>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}
						{grouped.map(([provider, providerModels]) => (
							<CommandGroup key={provider} heading={provider}>
								{providerModels.map((model) => {
									const isAvailable = model.available !== false;
									const logo = getProviderLogo(model.vendor, model.provider);
									const modelKey = getModelKey(model.provider, model.id);

									const item = (
										<CommandItem
											key={modelKey}
											value={model.name}
											disabled={!isAvailable}
											onSelect={() => {
												onModelChange(modelKey);
												setOpen(false);
											}}
											className={`flex items-center justify-between gap-2 w-full ${
												!isAvailable ? "opacity-50" : ""
											}`}
										>
											<div className="flex items-center gap-2 min-w-0">
												{logo ? (
													<div className="w-4 h-4 shrink-0">
														{renderLogo(logo, theme)}
													</div>
												) : (
													renderMonogram(model.provider)
												)}
												<span className="truncate">{model.name}</span>
											</div>
											<div className="flex items-center gap-2 shrink-0">
												{getImageSupportIcon(model.supportsImages)}
												{!isAvailable && (
													<Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
												)}
												<Check
													className={cn(
														"size-4 shrink-0",
														selectedModelId === modelKey
															? "opacity-100"
															: "opacity-0",
													)}
												/>
											</div>
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
