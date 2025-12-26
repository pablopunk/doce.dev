import type { APIRoute } from "astro";
import { checkDockerHealth } from "@/server/docker/health";

/**
 * GET /api/health/docker
 * 
 * Health check endpoint to verify Docker daemon is available.
 * Used by the frontend to determine if the application can function.
 */
export const GET: APIRoute = async () => {
  const result = await checkDockerHealth();
  
  return new Response(
    JSON.stringify(result),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};
