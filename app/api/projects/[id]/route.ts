import { NextResponse } from "next/server"
import { getProject, deleteProject, getFiles } from "@/lib/db"
import { deleteProjectFiles } from "@/lib/file-system"
import { listProjectContainers, stopContainer, removeContainer } from "@/lib/docker"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = await getProject(id)
  const files = await getFiles(id)

  return NextResponse.json({ ...project, files })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const containers = await listProjectContainers(id)
    for (const container of containers) {
      await stopContainer(container.Id)
      await removeContainer(container.Id)
    }

    // Delete project files
    await deleteProjectFiles(id)

    // Delete from database
    await deleteProject(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete project:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
