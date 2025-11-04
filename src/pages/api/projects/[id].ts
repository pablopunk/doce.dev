import type { APIRoute } from "astro";
import { deleteProject, getFiles, getProject } from "@/lib/db";
import { deleteProjectFiles } from "@/lib/file-system";
import { listProjectContainers, removeContainer, stopContainer } from "@/lib/docker";

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  const project = await getProject(id);

  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const files = await getFiles(id);
  return Response.json({ ...project, files });
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    const containers = await listProjectContainers(id);
    for (const container of containers) {
      await stopContainer(container.Id);
      await removeContainer(container.Id);
    }

    await deleteProjectFiles(id);
    await deleteProject(id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return Response.json({ error: "Failed to delete project" }, { status: 500 });
  }
};
