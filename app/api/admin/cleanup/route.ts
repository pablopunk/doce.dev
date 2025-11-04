import { NextResponse } from "next/server"
import { cleanupOldContainers } from "@/lib/docker"

export async function POST() {
  try {
    await cleanupOldContainers()
    return NextResponse.json({ success: true, message: "Cleanup completed" })
  } catch (error) {
    console.error("Cleanup failed:", error)
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 })
  }
}
