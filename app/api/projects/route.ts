import { NextResponse } from "next/server"
import { getProjects, createProject } from "@/lib/db"

export async function GET() {
  const projects = await getProjects()
  return NextResponse.json(projects)
}

export async function POST(req: Request) {
  const { name, description } = await req.json()
  const project = await createProject(name, description)
  return NextResponse.json(project)
}
