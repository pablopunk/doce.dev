import type { APIRoute } from "astro";
import bcrypt from "bcryptjs";
import { createUser, isSetupComplete } from "@/lib/db";

export const POST: APIRoute = async ({ request }) => {
  try {
    if (isSetupComplete()) {
      return Response.json({ error: "Setup already completed" }, { status: 400 });
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json({ error: "Username and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser(username, passwordHash);

    return Response.json({ success: true, userId: user.id });
  } catch (error) {
    console.error("[v0] Setup user error:", error);
    const message = error instanceof Error ? error.message : "Failed to create user";
    return Response.json({ error: message }, { status: 500 });
  }
};
