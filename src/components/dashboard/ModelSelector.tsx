"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Zap, Brain, CameraOff } from "lucide-react";
import { Openai } from "@/components/ui/svgs/openai";
import { OpenaiDark } from "@/components/ui/svgs/openaiDark";
import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack";
import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite";
import { Gemini } from "@/components/ui/svgs/gemini";
import { ZaiLight } from "@/components/ui/svgs/zaiLight";
import { ZaiDark } from "@/components/ui/svgs/zaiDark";
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const PROVIDER_LOGOS: Record<
	string,
	{ light: React.ComponentType<any>; dark: React.ComponentType<any> }
> = {
	OpenAI: { light: Openai, dark: OpenaiDark },
	Anthropic: { light: AnthropicBlack, dark: AnthropicWhite },
	Google: { light: Gemini, dark: Gemini },
	"Z.ai": { light: ZaiLight, dark: ZaiDark },
};

interface ModelSelectorProps {
	models: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		description?: string;
		tier?: "fast" | "top";
		supportsImages?: boolean;
	}>;
	selectedModelId: string;
	onModelChange: (modelId: string) => void;
}

function getTierIcon(tier?: string) {
	if (tier === "fast") return <Zap className="w-4 h-4 text-muted-foreground" />;
	if (tier === "top")
		return <Brain className="w-4 h-4 text-muted-foreground" />;
	return null;
}

function getImageSupportIcon(supportsImages?: boolean) {
	if (supportsImages === false) {
		return <CameraOff className="w-4 h-4 text-muted-foreground" />;
	}
	return null;
}

export function ModelSelector({
	models,
	selectedModelId,
	onModelChange,
}: ModelSelectorProps) {
	const [theme, setTheme] = useState<"light" | "dark">("light");

	// Get theme from document class or context
	useEffect(() => {
		const isDark = document.documentElement.classList.contains("dark");
		setTheme(isDark ? "dark" : "light");

		// Listen for theme changes
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

	const selectedModel = models.find((m) => m.id === selectedModelId);

	// Group models by provider
	const grouped = Array.from(
		models.reduce(
			(acc, model) => {
				const provider = model.provider;
				if (!acc.has(provider)) {
					acc.set(provider, []);
				}
				const group = acc.get(provider);
				if (group) {
					group.push(model);
				}
				return acc;
			},
			new Map<
				string,
				Array<{
					id: string;
					name: string;
					provider: string;
					tier?: "fast" | "top";
					supportsImages?: boolean;
				}>
			>(),
		),
	);

	const selectedProvider = selectedModel?.provider;
	const LogoVariants = selectedProvider
		? PROVIDER_LOGOS[selectedProvider]
		: null;

	const renderLogo = (logoVariants: typeof LogoVariants) => {
		if (!logoVariants) return null;
		const Logo = theme === "dark" ? logoVariants.dark : logoVariants.light;
		return <Logo className="w-full h-full" />;
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-ring">
				{LogoVariants && (
					<div className="w-4 h-4">{renderLogo(LogoVariants)}</div>
				)}
				<span>{selectedModel?.name || "Select model"}</span>
				{selectedModel && getTierIcon(selectedModel.tier)}
				{selectedModel && getImageSupportIcon(selectedModel.supportsImages)}
				<ChevronDown className="w-4 h-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				<DropdownMenuRadioGroup
					value={selectedModelId}
					onValueChange={onModelChange}
				>
					{grouped.map(([provider, providerModels], index) => {
						const LogoVariants = PROVIDER_LOGOS[provider];
						return (
							<DropdownMenuGroup key={provider}>
								{index > 0 && <DropdownMenuSeparator />}
								<DropdownMenuLabel className="flex items-center gap-2">
									{LogoVariants && (
										<div className="w-4 h-4">{renderLogo(LogoVariants)}</div>
									)}
									{provider}
								</DropdownMenuLabel>
								{providerModels.map((model) => (
									<DropdownMenuRadioItem
										key={model.id}
										value={model.id}
										className="flex flex-col items-start"
									>
										<div className="flex items-center gap-2">
											<span className="font-medium">{model.name}</span>
											{getTierIcon(model.tier)}
											{getImageSupportIcon(model.supportsImages)}
										</div>
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuGroup>
						);
					})}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
