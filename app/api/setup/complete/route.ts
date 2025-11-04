import { type NextRequest, NextResponse } from "next/server"
import { setConfig, isSetupComplete } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    // Check if setup is already complete
    if (isSetupComplete()) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 400 })
    }

    // Mark setup as complete
    setConfig("setup_complete", "true")

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Setup complete error:", error)
    return NextResponse.json({ error: error.message || "Failed to complete setup" }, { status: 500 })
  }
}
