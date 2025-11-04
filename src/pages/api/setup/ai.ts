import type { APIRoute } from "astro";
import { appendFile } from "fs/promises";
import { join } from "path";
import { isSetupComplete, setConfig } from "@/lib/db";

export const POST: APIRoute = async ({ request }) => {
  try {
    if (isSetupComplete()) {
      return Response.json({ error: "Setup already completed" }, { status: 400 });
    }

    const { provider, apiKey } = await request.json();

    if (!provider || !apiKey) {
      return Response.json({ error: "Provider and API key are required" }, { status: 400 });
    }

    setConfig("ai_provider", provider);
    setConfig(`${provider}_api_key`, apiKey);

    const envPath = join(process.cwd(), ".env.local");
    const envContent = provider === "openai" ? `OPENAI_API_KEY=${apiKey}\n` : `ANTHROPIC_API_KEY=${apiKey}\n`;

    try {
      await appendFile(envPath, envContent);
    } catch (error) {
      console.error("[v0] Failed to write .env file:", error);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[v0] Setup AI error:", error);
    const message = error instanceof Error ? error.message : "Failed to configure AI";
    return Response.json({ error: message }, { status: 500 });
  }
};
