import type { APIRoute } from "astro";
import { getDeployment, updateDeployment } from "@/lib/db";
import { getContainerStatus, removeContainer, stopContainer } from "@/lib/docker";

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Deployment id is required" }, { status: 400 });
  }

  try {
    const deployment = await getDeployment(id);
    if (!deployment) {
      return Response.json({ error: "Deployment not found" }, { status: 404 });
    }

    const containerStatus = await getContainerStatus(deployment.container_id);
    return Response.json({ ...deployment, containerStatus });
  } catch (error) {
    console.error("Failed to get deployment:", error);
    return Response.json({ error: "Failed to get deployment" }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Deployment id is required" }, { status: 400 });
  }

  try {
    const deployment = await getDeployment(id);
    if (!deployment) {
      return Response.json({ error: "Deployment not found" }, { status: 404 });
    }

    await stopContainer(deployment.container_id);
    await removeContainer(deployment.container_id);
    await updateDeployment(id, { status: "stopped" });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete deployment:", error);
    return Response.json({ error: "Failed to delete deployment" }, { status: 500 });
  }
};
