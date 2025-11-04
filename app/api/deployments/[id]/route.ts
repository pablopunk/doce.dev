import { NextResponse } from "next/server"
import { stopContainer, removeContainer, getContainerStatus } from "@/lib/docker"
import { updateDeployment } from "@/lib/db"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { default: postgres } = await import("postgres")
    const sql = postgres(process.env.DATABASE_URL!)

    const [deployment] = await sql`
      SELECT * FROM deployments WHERE id = ${id}
    `

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 })
    }

    // Stop and remove container
    await stopContainer(deployment.container_id)
    await removeContainer(deployment.container_id)

    // Update deployment status
    await updateDeployment(id, { status: "stopped" })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete deployment:", error)
    return NextResponse.json({ error: "Failed to delete deployment" }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const { default: postgres } = await import("postgres")
    const sql = postgres(process.env.DATABASE_URL!)

    const [deployment] = await sql`
      SELECT * FROM deployments WHERE id = ${id}
    `

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 })
    }

    // Check container status
    const status = await getContainerStatus(deployment.container_id)

    return NextResponse.json({
      ...deployment,
      containerStatus: status,
    })
  } catch (error) {
    console.error("Failed to get deployment:", error)
    return NextResponse.json({ error: "Failed to get deployment" }, { status: 500 })
  }
}
