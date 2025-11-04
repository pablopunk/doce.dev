import type { APIRoute } from "astro";
import { createDeployment, getDeployments, getProject, updateProject } from "@/lib/db";
import { createDeploymentContainer } from "@/lib/docker";

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

    const { containerId, url, deploymentId } = await createDeploymentContainer(id);
    const deployment = await createDeployment(id, containerId, url);

    await updateProject(id, {
      deployed_url: url,
      status: "deployed",
    });

    return Response.json({
      success: true,
      deployment: {
        id: deployment.id,
        containerId,
        url,
        deploymentId,
      },
    });
  } catch (error) {
    console.error("Failed to deploy:", error);
    return Response.json({ error: "Failed to deploy project" }, { status: 500 });
  }
};

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    const deployments = await getDeployments(id);
    return Response.json({ deployments });
  } catch (error) {
    console.error("Failed to get deployments:", error);
    return Response.json({ error: "Failed to get deployments" }, { status: 500 });
  }
};
