import type { APIRoute } from "astro";
import { cleanupOldContainers } from "@/lib/docker";

export const POST: APIRoute = async () => {
  try {
    await cleanupOldContainers();
    return Response.json({ success: true, message: "Cleanup completed" });
  } catch (error) {
    console.error("Cleanup failed:", error);
    return Response.json({ error: "Cleanup failed" }, { status: 500 });
  }
};
