import Docker from "dockerode"
import { nanoid } from "nanoid"

const docker = new Docker({
  socketPath: process.env.DOCKER_HOST || "/var/run/docker.sock",
})

export interface ContainerConfig {
  projectId: string
  port?: number
  subdomain?: string
  type: "preview" | "deployment"
}

export async function createPreviewContainer(
  projectId: string,
): Promise<{ containerId: string; url: string; port: number }> {
  const containerName = `doce-preview-${projectId}`
  const port = await findAvailablePort()
  const subdomain = `preview-${projectId.slice(0, 8)}`

  try {
    const existingContainer = await getContainerByName(containerName)
    if (existingContainer) {
      await existingContainer.stop()
      await existingContainer.remove()
    }

    const imageName = await buildProjectImage(projectId)

    const container = await docker.createContainer({
      name: containerName,
      Image: imageName,
      ExposedPorts: {
        "3000/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "3000/tcp": [{ HostPort: port.toString() }],
        },
        NetworkMode: "doce-network",
      },
      Labels: {
        "traefik.enable": "true",
        [`traefik.http.routers.${subdomain}.rule`]: `PathPrefix(\`/preview/${projectId}\`)`,
        [`traefik.http.routers.${subdomain}.entrypoints`]: "web",
        [`traefik.http.services.${subdomain}.loadbalancer.server.port`]: "3000",
        [`traefik.http.middlewares.${subdomain}-strip.stripprefix.prefixes`]: `/preview/${projectId}`,
        [`traefik.http.routers.${subdomain}.middlewares`]: `${subdomain}-strip`,
        [`traefik.http.routers.${subdomain}.priority`]: "10",
        "doce.project.id": projectId,
        "doce.container.type": "preview",
      },
    })

    await container.start()

    const url = `/preview/${projectId}`
    return { containerId: container.id, url, port }
  } catch (error) {
    console.error("Failed to create preview container:", error)
    throw error
  }
}

export async function createDeploymentContainer(
  projectId: string,
): Promise<{ containerId: string; url: string; deploymentId: string }> {
  const deploymentId = nanoid(10)
  const containerName = `doce-deploy-${deploymentId}`
  const port = await findAvailablePort()
  const subdomain = `deploy-${deploymentId}`

  try {
    const imageName = await buildProjectImage(projectId)

    const container = await docker.createContainer({
      name: containerName,
      Image: imageName,
      ExposedPorts: {
        "3000/tcp": {},
      },
      HostConfig: {
        PortBindings: {
          "3000/tcp": [{ HostPort: port.toString() }],
        },
        NetworkMode: "doce-network",
        RestartPolicy: {
          Name: "unless-stopped",
        },
      },
      Labels: {
        "traefik.enable": "true",
        [`traefik.http.routers.${subdomain}.rule`]: `PathPrefix(\`/site/${deploymentId}\`)`,
        [`traefik.http.routers.${subdomain}.entrypoints`]: "web",
        [`traefik.http.services.${subdomain}.loadbalancer.server.port`]: "3000",
        [`traefik.http.middlewares.${subdomain}-strip.stripprefix.prefixes`]: `/site/${deploymentId}`,
        [`traefik.http.routers.${subdomain}.middlewares`]: `${subdomain}-strip`,
        [`traefik.http.routers.${subdomain}.priority`]: "10",
        "doce.project.id": projectId,
        "doce.deployment.id": deploymentId,
        "doce.container.type": "deployment",
      },
    })

    await container.start()

    await waitForContainer(container.id, 30000)

    const url = `/site/${deploymentId}`
    return { containerId: container.id, url, deploymentId }
  } catch (error) {
    console.error("Failed to create deployment container:", error)
    throw error
  }
}

async function buildProjectImage(projectId: string): Promise<string> {
   const imageName = `doce-project-${projectId}:latest`
   const projectPath = `/app/projects/${projectId}`

   const dockerfile = `
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g http-server

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["http-server", "dist", "-p", "3000", "--cors"]
`

  const fs = require("fs").promises
  await fs.writeFile(`${projectPath}/Dockerfile`, dockerfile)

  const stream = await docker.buildImage(
    {
      context: projectPath,
      src: ["."],
    },
    {
      t: imageName,
      dockerfile: "Dockerfile",
    },
  )

  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (err: any, res: any) => {
      if (err) reject(err)
      else resolve(res)
    })
  })

  return imageName
}

async function waitForContainer(containerId: string, timeout = 30000): Promise<void> {
  const startTime = Date.now()
  const container = docker.getContainer(containerId)

  while (Date.now() - startTime < timeout) {
    try {
      const info = await container.inspect()
      if (info.State.Running) {
        // Wait a bit more for the app to start
        await new Promise((resolve) => setTimeout(resolve, 2000))
        return
      }
    } catch (error) {
      // Container not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  throw new Error("Container failed to start within timeout")
}

export async function stopContainer(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId)
    await container.stop()
  } catch (error) {
    console.error("Failed to stop container:", error)
  }
}

export async function removeContainer(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId)
    await container.remove({ force: true })
  } catch (error) {
    console.error("Failed to remove container:", error)
  }
}

export async function getContainerStatus(containerId: string): Promise<"running" | "stopped" | "not-found"> {
  try {
    const container = docker.getContainer(containerId)
    const info = await container.inspect()
    return info.State.Running ? "running" : "stopped"
  } catch (error) {
    return "not-found"
  }
}

async function getContainerByName(name: string): Promise<Docker.Container | null> {
  try {
    const containers = await docker.listContainers({ all: true })
    const containerInfo = containers.find((c) => c.Names.some((n) => n === `/${name}`))
    return containerInfo ? docker.getContainer(containerInfo.Id) : null
  } catch (error) {
    return null
  }
}

async function findAvailablePort(): Promise<number> {
  const basePort = 10000
  const maxPort = 20000
  return basePort + Math.floor(Math.random() * (maxPort - basePort))
}

export async function listProjectContainers(projectId: string): Promise<any[]> {
  const containers = await docker.listContainers({ all: true })
  return containers.filter((c) => c.Labels && c.Labels["doce.project.id"] === projectId)
}

export async function cleanupOldContainers(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
  const containers = await docker.listContainers({ all: true })
  const now = Date.now()

  for (const containerInfo of containers) {
    if (containerInfo.Labels && containerInfo.Labels["doce.container.type"] === "preview") {
      const created = containerInfo.Created * 1000
      if (now - created > maxAge) {
        try {
          const container = docker.getContainer(containerInfo.Id)
          await container.stop()
          await container.remove()
          console.log(`Cleaned up old preview container: ${containerInfo.Id}`)
        } catch (error) {
          console.error(`Failed to cleanup container ${containerInfo.Id}:`, error)
        }
      }
    }
  }
}
