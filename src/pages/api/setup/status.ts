import type { APIRoute } from "astro";
import { isSetupComplete } from "@/lib/db";

export const GET: APIRoute = async () => {
  try {
    return Response.json({ setupComplete: isSetupComplete() });
  } catch (error) {
    console.error("[doce.dev] Setup status error:", error);
    const message = error instanceof Error ? error.message : "Failed to check setup status";
    return Response.json({ error: message }, { status: 500 });
  }
};
