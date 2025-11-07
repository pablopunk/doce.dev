import type { APIRoute } from "astro";
import { createPreviewContainer, stopPreviewForProject, getPreviewState } from "@/lib/docker";
import { getProject, updateProject } from "@/lib/db";

export const POST: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if preview is already running in Docker
    const existingState = await getPreviewState(id);
    if (existingState) {
      console.log(`Preview already running for ${id}, syncing DB with Docker state`);
      
      // Sync DB with Docker reality
      await updateProject(id, {
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

    await updateProject(id, {
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
    const project = await getProject(id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Always check Docker state first (source of truth)
    const dockerState = await getPreviewState(id);
    
    if (dockerState) {
      // Sync DB if out of sync
      if (project.preview_url !== dockerState.url) {
        console.log(`Syncing DB for ${id}: ${project.preview_url} -> ${dockerState.url}`);
        await updateProject(id, {
          preview_url: dockerState.url,
          status: "preview",
        });
      }
      
      return Response.json({ url: dockerState.url, status: "running", port: dockerState.port });
    }

    // No container running - clear stale DB data
    if (project.preview_url) {
      console.log(`Clearing stale preview URL for ${id}`);
      await updateProject(id, {
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

    await updateProject(id, {
      preview_url: null,
      status: "draft",
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete preview:", error);
    return Response.json({ error: "Failed to delete preview" }, { status: 500 });
  }
};
