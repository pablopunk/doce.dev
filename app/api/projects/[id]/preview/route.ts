import { NextResponse } from "next/server"
import { createPreviewContainer } from "@/lib/docker"
import { updateProject, getProject } from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Create preview container
    const { containerId, url, port } = await createPreviewContainer(id)

    // Update project with preview URL
    await updateProject(id, {
      preview_url: url,
      status: "preview",
    })

    return NextResponse.json({
      success: true,
      containerId,
      url,
      port,
    })
  } catch (error) {
    console.error("Failed to create preview:", error)
    return NextResponse.json({ error: "Failed to create preview environment" }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Check if preview exists and is running
    if (project.preview_url) {
      // Extract container info from project
      return NextResponse.json({
        url: project.preview_url,
        status: "running",
      })
    }

    return NextResponse.json({
      status: "not-created",
    })
  } catch (error) {
    console.error("Failed to get preview status:", error)
    return NextResponse.json({ error: "Failed to get preview status" }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { stopContainer, removeContainer } = await import("@/lib/docker")

    // Stop and remove preview container
    const containerName = `v0-preview-${id}`
    await stopContainer(containerName)
    await removeContainer(containerName)

    // Update project
    await updateProject(id, {
      preview_url: null,
      status: "draft",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete preview:", error)
    return NextResponse.json({ error: "Failed to delete preview" }, { status: 500 })
  }
}
