import type { APIRoute } from "astro";
import { createProject, getProjects } from "@/lib/db";

export const GET: APIRoute = async () => {
  const projects = await getProjects();
  return Response.json(projects);
};

export const POST: APIRoute = async ({ request }) => {
  const { name, description } = await request.json();
  const project = await createProject(name, description);
  return Response.json(project);
};
