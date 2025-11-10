import type { APIRoute } from "astro";
import { getConfig, setConfig } from "@/lib/db";

export const GET: APIRoute = async () => {
	const providers = ["openrouter", "anthropic", "openai", "google", "xai"];

	const keys: Record<string, boolean> = {};
	for (const provider of providers) {
		const key = getConfig(`${provider}_api_key`);
		keys[provider] = Boolean(key);
	}

	return Response.json({ keys });
};

export const POST: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();
		const { provider, apiKey } = body;

		if (!provider || typeof provider !== "string") {
			return Response.json({ error: "Provider is required" }, { status: 400 });
		}

		const validProviders = [
			"openrouter",
			"anthropic",
			"openai",
			"google",
			"xai",
		];
		if (!validProviders.includes(provider)) {
			return Response.json({ error: "Invalid provider" }, { status: 400 });
		}

		if (apiKey && typeof apiKey === "string" && apiKey.trim()) {
			setConfig(`${provider}_api_key`, apiKey.trim());
		} else {
			setConfig(`${provider}_api_key`, "");
		}

		return Response.json({ success: true });
	} catch (error) {
		console.error("Failed to save API key:", error);
		return Response.json({ error: "Failed to save API key" }, { status: 500 });
	}
};
