import { NextResponse } from "next/server"
import postgres from "postgres"
import Docker from "dockerode"

const sql = postgres(process.env.DATABASE_URL!)
const docker = new Docker({
  socketPath: process.env.DOCKER_HOST || "/var/run/docker.sock",
})

export async function GET() {
  try {
    // Get project count
    const [projectCount] = await sql`
      SELECT COUNT(*) as count FROM projects
    `

    // Get deployment count
    const [deploymentCount] = await sql`
      SELECT COUNT(*) as count FROM deployments WHERE status = 'running'
    `

    // Get active preview count
    const [previewCount] = await sql`
      SELECT COUNT(*) as count FROM projects WHERE preview_url IS NOT NULL
    `

    // Get container count
    const containers = await docker.listContainers()
    const v0Containers = containers.filter((c) => c.Labels && c.Labels["v0.project.id"])

    return NextResponse.json({
      totalProjects: Number.parseInt(projectCount.count),
      totalDeployments: Number.parseInt(deploymentCount.count),
      activePreviews: Number.parseInt(previewCount.count),
      totalContainers: v0Containers.length,
    })
  } catch (error) {
    console.error("Failed to get stats:", error)
    return NextResponse.json(
      {
        totalProjects: 0,
        totalDeployments: 0,
        activePreviews: 0,
        totalContainers: 0,
      },
      { status: 500 },
    )
  }
}
