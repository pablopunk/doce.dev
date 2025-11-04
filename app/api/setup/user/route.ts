import { type NextRequest, NextResponse } from "next/server"
import { createUser, isSetupComplete } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(request: NextRequest) {
  try {
    // Check if setup is already complete
    if (isSetupComplete()) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 400 })
    }

    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user
    const user = createUser(username, passwordHash)

    return NextResponse.json({ success: true, userId: user.id })
  } catch (error: any) {
    console.error("[v0] Setup user error:", error)
    return NextResponse.json({ error: error.message || "Failed to create user" }, { status: 500 })
  }
}
