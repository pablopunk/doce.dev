import { NextResponse } from "next/server"
import { createDeploymentContainer } from "@/lib/docker"
import { createDeployment, updateProject, getProject } from "@/lib/db"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const project = await getProject(id)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Create deployment container
    const { containerId, url, deploymentId } = await createDeploymentContainer(id)

    // Save deployment to database
    const deployment = await createDeployment(id, containerId, url)

    // Update project with deployed URL
    await updateProject(id, {
      deployed_url: url,
      status: "deployed",
    })

    return NextResponse.json({
      success: true,
      deployment: {
        id: deployment.id,
        containerId,
        url,
        deploymentId,
      },
    })
  } catch (error) {
    console.error("Failed to deploy:", error)
    return NextResponse.json({ error: "Failed to deploy project" }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { getDeployments } = await import("@/lib/db")
    const deployments = await getDeployments(id)

    return NextResponse.json({ deployments })
  } catch (error) {
    console.error("Failed to get deployments:", error)
    return NextResponse.json({ error: "Failed to get deployments" }, { status: 500 })
  }
}
