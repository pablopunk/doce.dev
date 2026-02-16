const VENDOR_TOKEN_TO_SLUG: Record<string, string> = {
	openai: "openai",
	openaicom: "openai",
	anthropic: "anthropic",
	google: "google",
	xai: "xai",
	zai: "z-ai",
	minimax: "minimax",
	kimi: "kimi",
	moonshot: "moonshot",
	moonshotai: "moonshot",
	openrouter: "openrouter",
	opencode: "opencode",
};

export function toVendorToken(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z]/g, "");
}

export function toVendorSlug(value: string): string {
	const token = toVendorToken(value);
	if (!token) {
		return value.trim().toLowerCase();
	}

	return VENDOR_TOKEN_TO_SLUG[token] ?? token;
}
