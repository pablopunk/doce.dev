import type { ComponentType, SVGProps } from "react";
import { AnthropicBlack } from "@/components/ui/svgs/anthropicBlack";
import { AnthropicWhite } from "@/components/ui/svgs/anthropicWhite";
import { Gemini } from "@/components/ui/svgs/gemini";
import { Kimi } from "@/components/ui/svgs/kimi";
import { Minimax } from "@/components/ui/svgs/minimax";
import { MinimaxDark } from "@/components/ui/svgs/minimaxDark";
import { Openai } from "@/components/ui/svgs/openai";
import { OpenaiDark } from "@/components/ui/svgs/openaiDark";
import { ZaiDark } from "@/components/ui/svgs/zaiDark";
import { ZaiLight } from "@/components/ui/svgs/zaiLight";

const LOCAL_LOGOS: Record<
	string,
	{
		light: ComponentType<SVGProps<SVGSVGElement>>;
		dark: ComponentType<SVGProps<SVGSVGElement>>;
	}
> = {
	openai: { light: Openai, dark: OpenaiDark },
	anthropic: { light: AnthropicBlack, dark: AnthropicWhite },
	google: { light: Gemini, dark: Gemini },
	"z-ai": { light: ZaiLight, dark: ZaiDark },
	minimax: { light: Minimax, dark: MinimaxDark },
	kimi: { light: Kimi, dark: Kimi },
	moonshot: { light: Kimi, dark: Kimi },
};

const PROVIDER_DOMAINS: Record<string, string> = {
	openrouter: "openrouter.ai",
	aws: "aws.amazon.com",
	azure: "azure.microsoft.com",
	cohere: "cohere.com",
	mistral: "mistral.ai",
	perplexity: "perplexity.ai",
	together: "together.ai",
	anyscale: "anyscale.com",
	deepseek: "deepseek.com",
	cloudflare: "cloudflare.com",
	workersai: "cloudflare.com",
};

export type ProviderLogoResult =
	| {
			type: "svg";
			light: ComponentType<SVGProps<SVGSVGElement>>;
			dark: ComponentType<SVGProps<SVGSVGElement>>;
	  }
	| {
			type: "external";
			url: string;
	  }
	| null;

export function getProviderLogo(
	provider: string,
	vendor?: string,
): ProviderLogoResult {
	const normalizedProvider = provider.toLowerCase();
	const normalizedVendor = vendor?.toLowerCase();

	if (normalizedProvider && LOCAL_LOGOS[normalizedProvider]) {
		return {
			type: "svg",
			light: LOCAL_LOGOS[normalizedProvider].light,
			dark: LOCAL_LOGOS[normalizedProvider].dark,
		};
	}

	if (normalizedVendor && LOCAL_LOGOS[normalizedVendor]) {
		return {
			type: "svg",
			light: LOCAL_LOGOS[normalizedVendor].light,
			dark: LOCAL_LOGOS[normalizedVendor].dark,
		};
	}

	const domain = PROVIDER_DOMAINS[normalizedProvider];
	if (domain) {
		return {
			type: "external",
			url: `https://favicon.im/${domain}?larger=true`,
		};
	}

	return null;
}

export function getProviderMonogram(provider: string): string {
	return provider.charAt(0).toUpperCase();
}
