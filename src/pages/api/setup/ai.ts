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
    let envContent = "";
    if (provider === "openai") {
      envContent = `OPENAI_API_KEY=${apiKey}\n`;
    } else if (provider === "anthropic") {
      envContent = `ANTHROPIC_API_KEY=${apiKey}\n`;
    } else if (provider === "openrouter") {
      envContent = `OPENROUTER_API_KEY=${apiKey}\n`;
    }

    try {
      await appendFile(envPath, envContent);
    } catch (error) {
      console.error("[doce.dev] Failed to write .env file:", error);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[doce.dev] Setup AI error:", error);
    const message = error instanceof Error ? error.message : "Failed to configure AI";
    return Response.json({ error: message }, { status: 500 });
  }
};
