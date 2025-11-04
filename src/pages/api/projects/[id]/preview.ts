import type { APIRoute } from "astro";
import { createPreviewContainer, removeContainer, stopContainer } from "@/lib/docker";
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

    const { containerId, url, port } = await createPreviewContainer(id);

    await updateProject(id, {
      preview_url: url,
      status: "preview",
    });

    return Response.json({ success: true, containerId, url, port });
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

    if (project.preview_url) {
      return Response.json({ url: project.preview_url, status: "running" });
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
    const containerName = `v0-preview-${id}`;
    await stopContainer(containerName);
    await removeContainer(containerName);

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
