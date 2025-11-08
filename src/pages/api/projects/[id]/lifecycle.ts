import type { APIRoute } from "astro";
import { stopPreviewForProject } from "@/lib/docker";
import { projectFacade } from "@/application/facades/project-facade";

// Track active project sessions with timeouts
const activeProjects = new Map<string, NodeJS.Timeout>();
const INACTIVITY_TIMEOUT = 60000; // 60 seconds (1 minute) of inactivity before stopping

// Heartbeat endpoint - keeps the project alive
export const POST: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    // Clear existing timeout if any
    const existingTimeout = activeProjects.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout - stop container if no heartbeat for INACTIVITY_TIMEOUT
    const timeout = setTimeout(async () => {
      try {
        console.log(`[Lifecycle] No heartbeat for ${INACTIVITY_TIMEOUT/1000}s, stopping preview for project ${id}`);
        await stopPreviewForProject(id);
        
        // Clear the preview URL from database
        await projectFacade.updateProject(id, {
          preview_url: null,
          status: "draft",
        });
        
        activeProjects.delete(id);
        console.log(`[Lifecycle] Successfully stopped preview for project ${id}`);
      } catch (error) {
        console.error(`[Lifecycle] Failed to stop preview for project ${id}:`, error);
        activeProjects.delete(id);
      }
    }, INACTIVITY_TIMEOUT);

    activeProjects.set(id, timeout);
    
    return Response.json({ success: true, timeout: INACTIVITY_TIMEOUT });
  } catch (error) {
    console.error("Failed to handle heartbeat:", error);
    return Response.json({ error: "Failed to handle heartbeat" }, { status: 500 });
  }
};
