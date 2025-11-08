import type { APIRoute } from "astro";
import { createPreviewContainer, stopPreviewForProject, getPreviewState } from "@/lib/docker";
import { projectFacade } from "@/application/facades/project-facade";

export const POST: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    // USE NEW ARCHITECTURE
    const project = await projectFacade.getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if preview is already running in Docker
    const existingState = await getPreviewState(id);
    if (existingState) {
      console.log(`Preview already running for ${id}, syncing DB with Docker state`);
      
      // USE NEW ARCHITECTURE - Sync DB with Docker reality
      await projectFacade.updateProject(id, {
        preview_url: existingState.url,
        status: "preview",
      });

      return Response.json({ 
        success: true, 
        containerId: existingState.containerId, 
        url: existingState.url, 
        port: existingState.port,
        reused: true
      });
    }

    // Create new preview container
    const { containerId, url, port } = await createPreviewContainer(id);

    // USE NEW ARCHITECTURE
    await projectFacade.updateProject(id, {
      preview_url: url,
      status: "preview",
    });

    return Response.json({ success: true, containerId, url, port, reused: false });
  } catch (error) {
    console.error("Failed to create preview:", error);
    return Response.json({ error: "Failed to create preview environment" }, { status: 500 });
  }
};

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    // USE NEW ARCHITECTURE
    const project = await projectFacade.getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Always check Docker state first (source of truth)
    const dockerState = await getPreviewState(id);
    
    if (dockerState) {
      // Sync DB if out of sync
      if (project.previewUrl !== dockerState.url) {
        console.log(`Syncing DB for ${id}: ${project.previewUrl} -> ${dockerState.url}`);
        // USE NEW ARCHITECTURE
        await projectFacade.updateProject(id, {
          preview_url: dockerState.url,
          status: "preview",
        });
      }
      
      return Response.json({ url: dockerState.url, status: "running", port: dockerState.port });
    }

    // No container running - clear stale DB data
    if (project.previewUrl) {
      console.log(`Clearing stale preview URL for ${id}`);
      // USE NEW ARCHITECTURE
      await projectFacade.updateProject(id, {
        preview_url: null,
        status: "draft",
      });
    }

    return Response.json({ status: "not-created" });
  } catch (error) {
    console.error("Failed to get preview status:", error);
    return Response.json({ error: "Failed to get preview status" }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    await stopPreviewForProject(id);

    // USE NEW ARCHITECTURE
    await projectFacade.updateProject(id, {
      preview_url: null,
      status: "draft",
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete preview:", error);
    return Response.json({ error: "Failed to delete preview" }, { status: 500 });
  }
};
