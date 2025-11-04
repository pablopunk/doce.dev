import { type NextRequest, NextResponse } from "next/server"
import { setConfig, isSetupComplete } from "@/lib/db"
import { writeFileSync } from "fs"
import { join } from "path"

export async function POST(request: NextRequest) {
  try {
    // Check if setup is already complete
    if (isSetupComplete()) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 400 })
    }

    const { provider, apiKey } = await request.json()

    if (!provider || !apiKey) {
      return NextResponse.json({ error: "Provider and API key are required" }, { status: 400 })
    }

    // Store in database
    setConfig("ai_provider", provider)
    setConfig(`${provider}_api_key`, apiKey)

    // Also write to .env file for Docker container
    const envPath = join(process.cwd(), ".env.local")
    const envContent = provider === "openai" ? `OPENAI_API_KEY=${apiKey}\n` : `ANTHROPIC_API_KEY=${apiKey}\n`

    try {
      writeFileSync(envPath, envContent, { flag: "a" })
    } catch (err) {
      console.error("[v0] Failed to write .env file:", err)
      // Continue anyway, we have it in the database
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Setup AI error:", error)
    return NextResponse.json({ error: error.message || "Failed to configure AI" }, { status: 500 })
  }
}
