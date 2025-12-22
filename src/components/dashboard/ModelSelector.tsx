import { ChevronDown } from "lucide-react";
import { Openai } from "@/components/ui/svgs/openai";
import { OpenaiDark } from "@/components/ui/svgs/openaiDark";
import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack";
import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite";
import { Google } from "@/components/ui/svgs/google";
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
	Google: { light: Google, dark: Google },
};

interface ModelSelectorProps {
	models: ReadonlyArray<{
		id: string;
		name: string;
		provider: string;
		description?: string;
	}>;
	selectedModelId: string;
	onModelChange: (modelId: string) => void;
}

export function ModelSelector({
	models,
	selectedModelId,
	onModelChange,
}: ModelSelectorProps) {
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
					description?: string;
				}>
			>(),
		),
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-ring">
				<span>{selectedModel?.name || "Select model"}</span>
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
									<div className="w-4 h-4">
										<LogoVariants.light className="w-full h-full dark:hidden" />
										<LogoVariants.dark className="w-full h-full hidden dark:block" />
									</div>
								)}
								{provider}
							</DropdownMenuLabel>
								{providerModels.map((model) => (
									<DropdownMenuRadioItem
										key={model.id}
										value={model.id}
										className="flex flex-col items-start"
									>
										<span className="font-medium">{model.name}</span>
										{model.description && (
											<span className="text-xs text-muted-foreground">
												{model.description}
											</span>
										)}
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
