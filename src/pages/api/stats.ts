import type { APIRoute } from "astro";
import Docker from "dockerode";
import db from "@/lib/db";

const docker = new Docker({
  socketPath: process.env.DOCKER_HOST || "/var/run/docker.sock",
});

export const GET: APIRoute = async () => {
  try {
    const totalProjects = (db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number }).count;
    const totalDeployments = (
      db.prepare("SELECT COUNT(*) as count FROM deployments WHERE status = 'running'").get() as { count: number }
    ).count;
    const activePreviews = (
      db.prepare("SELECT COUNT(*) as count FROM projects WHERE preview_url IS NOT NULL").get() as { count: number }
    ).count;

    const containers = await docker.listContainers();
    const totalContainers = containers.filter((c) => c.Labels && c.Labels["v0.project.id"]).length;

    return Response.json({
      totalProjects,
      totalDeployments,
      activePreviews,
      totalContainers,
    });
  } catch (error) {
    console.error("Failed to get stats:", error);
    return Response.json(
      {
        totalProjects: 0,
        totalDeployments: 0,
        activePreviews: 0,
        totalContainers: 0,
      },
      { status: 500 },
    );
  }
};
