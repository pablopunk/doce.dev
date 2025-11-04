import { NextResponse } from "next/server"
import { isSetupComplete } from "@/lib/db"

export async function GET() {
  try {
    const complete = isSetupComplete()
    return NextResponse.json({ setupComplete: complete })
  } catch (error: any) {
    console.error("[v0] Setup status error:", error)
    return NextResponse.json({ error: error.message || "Failed to check setup status" }, { status: 500 })
  }
}
