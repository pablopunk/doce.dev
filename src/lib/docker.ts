import Docker from "dockerode";
import { nanoid } from "nanoid";
import path from "path";

const docker = new Docker({
	socketPath: process.env.DOCKER_HOST || "/var/run/docker.sock",
});

export interface ContainerConfig {
	projectId: string;
	port?: number;
	subdomain?: string;
	type: "preview" | "deployment";
}

export async function createPreviewContainer(
	projectId: string,
): Promise<{ containerId: string; url: string; port: number }> {
	const containerName = `doce-preview-${projectId}`;
	const port = await findAvailablePort();
	const subdomain = `preview-${projectId.slice(0, 8)}`;

	try {
		// Import DB functions for logging
		const { clearBuildLogs, appendBuildLog } = await import("@/lib/db");

		// Clear previous build logs
		clearBuildLogs(projectId);

		// Check if container already exists and is running
		const existingContainer = await getContainerByName(containerName);
		if (existingContainer) {
			const info = await existingContainer.inspect();
			if (info.State.Running) {
				console.log(`Preview container already running for ${projectId}`);
				appendBuildLog(projectId, `✓ Preview container already running\n`);
				const existingPort = parseInt(
					info.HostConfig.PortBindings["3000/tcp"]?.[0]?.HostPort ||
						port.toString(),
				);
				return {
					containerId: existingContainer.id,
					url: `http://localhost:${existingPort}`,
					port: existingPort,
				};
			}
			appendBuildLog(projectId, `⟳ Removing existing stopped container\n`);
			await existingContainer.remove({ force: true });
		}

		const DATA_DIR = path.dirname(
			process.env.DATABASE_PATH || "./data/doceapp.db",
		);
		const projectPath = path.resolve(
			path.join(DATA_DIR, "projects", projectId),
		);

		console.log(
			`Starting preview via docker-compose for ${projectId} at ${projectPath}`,
		);
		appendBuildLog(projectId, `⟳ Starting preview container...\n`);
		appendBuildLog(projectId, `📂 Project path: ${projectPath}\n`);

		// Generate docker-compose override for this specific instance with port and labels
		const composeOverride = `services:
  app:
    container_name: ${containerName}
    ports:
      - "${port}:3000"
    labels:
      traefik.enable: "true"
      traefik.http.routers.${subdomain}.rule: "PathPrefix(\`/preview/${projectId}\`)"
      traefik.http.routers.${subdomain}.entrypoints: "web"
      traefik.http.services.${subdomain}.loadbalancer.server.port: "3000"
      traefik.http.middlewares.${subdomain}-strip.stripprefix.prefixes: "/preview/${projectId}"
      traefik.http.routers.${subdomain}.middlewares: "${subdomain}-strip"
      traefik.http.routers.${subdomain}.priority: "10"
      doce.project.id: "${projectId}"
      doce.container.type: "preview"
`;

		const fs = await import("fs/promises");
		await fs.writeFile(
			path.join(projectPath, "docker-compose.override.yml"),
			composeOverride,
		);
		appendBuildLog(projectId, `✓ Generated docker-compose override\n`);

		// Use docker-compose via command line (more reliable than docker SDK for compose)
		const { spawn } = await import("child_process");

		// Start containers with docker-compose (use dev config for preview)
		appendBuildLog(projectId, `⟳ Running docker-compose up...\n\n`);

		const composeProcess = spawn(
			"docker-compose",
			[
				"-f",
				"docker-compose.dev.yml",
				"-f",
				"docker-compose.override.yml",
				"up",
				"-d",
			],
			{ cwd: projectPath },
		);

		// Capture stdout and stderr
		composeProcess.stdout.on("data", (data) => {
			const log = data.toString();
			console.log(log);
			appendBuildLog(projectId, log);
		});

		composeProcess.stderr.on("data", (data) => {
			const log = data.toString();
			console.error(log);
			appendBuildLog(projectId, log);
		});

		// Wait for the process to complete
		await new Promise<void>((resolve, reject) => {
			composeProcess.on("close", (code) => {
				if (code === 0) {
					appendBuildLog(
						projectId,
						`\n✓ docker-compose up completed successfully\n`,
					);
					resolve();
				} else {
					appendBuildLog(
						projectId,
						`\n✗ docker-compose up failed with exit code ${code}\n`,
					);
					reject(new Error(`docker-compose up failed with exit code ${code}`));
				}
			});
		});

		console.log(`Preview started for ${projectId}, waiting for container...`);
		appendBuildLog(projectId, `⟳ Waiting for container to be ready...\n`);

		// Wait for the container to appear and be running
		let attempts = 0;
		let container;
		while (attempts < 30) {
			container = await getContainerByName(containerName);
			if (container) {
				const info = await container.inspect();
				if (info.State.Running) {
					console.log(`Preview container is running for ${projectId}`);
					const { appendBuildLog } = await import("@/lib/db");
					appendBuildLog(projectId, `✓ Container is running\n`);
					appendBuildLog(
						projectId,
						`🚀 Preview available at http://localhost:${port}\n`,
					);
					break;
				}
			}
			await new Promise((resolve) => setTimeout(resolve, 2000));
			attempts++;
		}

		if (!container) {
			const { appendBuildLog } = await import("@/lib/db");
			appendBuildLog(projectId, `✗ Container failed to start within timeout\n`);
			throw new Error("Container failed to start within timeout");
		}

		// For local development, use direct port access
		// In production with Traefik, this would be the path-based URL
		const url = `http://localhost:${port}`;
		return { containerId: container.id, url, port };
	} catch (error) {
		console.error("Failed to create preview container:", error);
		const { appendBuildLog } = await import("@/lib/db");
		appendBuildLog(
			projectId,
			`\n✗ ERROR: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		throw error;
	}
}

export async function createDeploymentContainer(
	projectId: string,
): Promise<{ containerId: string; url: string; deploymentId: string }> {
	const deploymentId = nanoid(10);
	const containerName = `doce-deploy-${deploymentId}`;
	const port = await findAvailablePort();
	const subdomain = `deploy-${deploymentId}`;

	try {
		const imageName = await buildProjectImage(projectId);

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
		});

		await container.start();

		await waitForContainer(container.id, 30000);

		const url = `/site/${deploymentId}`;
		return { containerId: container.id, url, deploymentId };
	} catch (error) {
		console.error("Failed to create deployment container:", error);
		throw error;
	}
}

async function buildProjectImage(projectId: string): Promise<string> {
	const imageName = `doce-project-${projectId}:latest`;
	const projectPath = `/app/projects/${projectId}`;

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
`;

	const fs = await import("fs/promises");
	await fs.writeFile(`${projectPath}/Dockerfile`, dockerfile);

	const stream = await docker.buildImage(
		{
			context: projectPath,
			src: ["."],
		},
		{
			t: imageName,
			dockerfile: "Dockerfile",
		},
	);

	await new Promise((resolve, reject) => {
		docker.modem.followProgress(stream, (err: any, res: any) => {
			if (err) reject(err);
			else resolve(res);
		});
	});

	return imageName;
}

async function waitForContainer(
	containerId: string,
	timeout = 30000,
): Promise<void> {
	const startTime = Date.now();
	const container = docker.getContainer(containerId);

	while (Date.now() - startTime < timeout) {
		try {
			const info = await container.inspect();
			if (info.State.Running) {
				// Wait a bit more for the app to start
				await new Promise((resolve) => setTimeout(resolve, 2000));
				return;
			}
		} catch (error) {
			// Container not ready yet
		}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	throw new Error("Container failed to start within timeout");
}

export async function stopContainer(containerId: string): Promise<void> {
	try {
		const container = docker.getContainer(containerId);
		await container.stop();
	} catch (error) {
		console.error("Failed to stop container:", error);
	}
}

export async function removeContainer(containerId: string): Promise<void> {
	try {
		const container = docker.getContainer(containerId);
		await container.remove({ force: true });
	} catch (error) {
		console.error("Failed to remove container:", error);
	}
}

export async function stopPreviewForProject(projectId: string): Promise<void> {
	const DATA_DIR = path.dirname(
		process.env.DATABASE_PATH || "./data/doceapp.db",
	);
	const projectPath = path.resolve(path.join(DATA_DIR, "projects", projectId));

	try {
		const { exec } = await import("child_process");
		const { promisify } = await import("util");
		const execAsync = promisify(exec);

		await execAsync(`docker-compose -f docker-compose.dev.yml down`, {
			cwd: projectPath,
		});
		console.log(`Stopped preview for project ${projectId}`);
	} catch (error) {
		console.error(`Failed to stop preview for project ${projectId}:`, error);
	}
}

export async function getContainerStatus(
	containerId: string,
): Promise<"running" | "stopped" | "not-found"> {
	try {
		const container = docker.getContainer(containerId);
		const info = await container.inspect();
		return info.State.Running ? "running" : "stopped";
	} catch (error) {
		return "not-found";
	}
}

async function getContainerByName(
	name: string,
): Promise<Docker.Container | null> {
	try {
		const containers = await docker.listContainers({ all: true });
		const containerInfo = containers.find((c) =>
			c.Names.some((n) => n === `/${name}`),
		);
		return containerInfo ? docker.getContainer(containerInfo.Id) : null;
	} catch (error) {
		return null;
	}
}

async function findAvailablePort(): Promise<number> {
	const basePort = 10000;
	const maxPort = 20000;
	return basePort + Math.floor(Math.random() * (maxPort - basePort));
}

/**
 * Get the actual preview state from Docker (source of truth)
 * Returns null if container doesn't exist or isn't running
 */
export async function getPreviewState(
	projectId: string,
): Promise<{ url: string; port: number; containerId: string } | null> {
	const containerName = `doce-preview-${projectId}`;

	try {
		const container = await getContainerByName(containerName);
		if (!container) {
			return null;
		}

		const info = await container.inspect();
		if (!info.State.Running) {
			return null;
		}

		// Extract port from container bindings
		const portBindings = info.HostConfig.PortBindings["3000/tcp"];
		if (!portBindings || portBindings.length === 0) {
			// Fallback: try to read from docker-compose.override.yml
			const portFromFile = await getPortFromComposeOverride(projectId);
			if (portFromFile) {
				return {
					url: `http://localhost:${portFromFile}`,
					port: portFromFile,
					containerId: container.id,
				};
			}
			return null;
		}

		const port = parseInt(portBindings[0].HostPort);
		const url = `http://localhost:${port}`;

		return {
			url,
			port,
			containerId: container.id,
		};
	} catch (error) {
		console.error(`Failed to get preview state for ${projectId}:`, error);
		return null;
	}
}

/**
 * Read the port from docker-compose.override.yml as fallback
 */
async function getPortFromComposeOverride(
	projectId: string,
): Promise<number | null> {
	try {
		const DATA_DIR = path.dirname(
			process.env.DATABASE_PATH || "./data/doceapp.db",
		);
		const projectPath = path.resolve(
			path.join(DATA_DIR, "projects", projectId),
		);
		const overridePath = path.join(projectPath, "docker-compose.override.yml");

		const fs = await import("fs/promises");
		const content = await fs.readFile(overridePath, "utf-8");

		// Parse port mapping like "12345:3000"
		const portMatch = content.match(/"(\d+):3000"/);
		if (portMatch) {
			return parseInt(portMatch[1]);
		}

		return null;
	} catch (error) {
		return null;
	}
}

export async function listProjectContainers(projectId: string): Promise<any[]> {
	const containers = await docker.listContainers({ all: true });
	return containers.filter(
		(c) => c.Labels && c.Labels["doce.project.id"] === projectId,
	);
}

export async function cleanupOldContainers(
	maxAge: number = 24 * 60 * 60 * 1000,
): Promise<void> {
	const containers = await docker.listContainers({ all: true });
	const now = Date.now();

	for (const containerInfo of containers) {
		if (
			containerInfo.Labels &&
			containerInfo.Labels["doce.container.type"] === "preview"
		) {
			const created = containerInfo.Created * 1000;
			if (now - created > maxAge) {
				try {
					const container = docker.getContainer(containerInfo.Id);
					await container.stop();
					await container.remove();
					console.log(`Cleaned up old preview container: ${containerInfo.Id}`);
				} catch (error) {
					console.error(
						`Failed to cleanup container ${containerInfo.Id}:`,
						error,
					);
				}
			}
		}
	}
}

/**
 * Prune unused Docker networks
 * This prevents "all predefined address pools have been fully subnetted" errors
 */
export async function pruneDockerNetworks(): Promise<void> {
	try {
		const { exec } = await import("child_process");
		const { promisify } = await import("util");
		const execAsync = promisify(exec);

		const { stdout } = await execAsync("docker network prune -f");
		console.log("Pruned unused Docker networks:", stdout.trim());
	} catch (error) {
		console.error("Failed to prune Docker networks:", error);
		throw error;
	}
}

async function ensureDockerImage(imageName: string): Promise<void> {
	try {
		// Check if image exists
		await docker.getImage(imageName).inspect();
		console.log(`Image ${imageName} already exists`);
	} catch (error) {
		// Image doesn't exist, pull it
		console.log(`Pulling Docker image ${imageName}...`);
		const stream = await docker.pull(imageName);

		await new Promise<void>((resolve, reject) => {
			docker.modem.followProgress(stream, (err: any, res: any) => {
				if (err) {
					console.error(`Failed to pull image ${imageName}:`, err);
					reject(err);
				} else {
					console.log(`Successfully pulled image ${imageName}`);
					resolve();
				}
			});
		});
	}
}

/**
 * Stream logs from a preview container
 * Returns a readable stream that emits log chunks
 */
export async function streamContainerLogs(
	projectId: string,
): Promise<NodeJS.ReadableStream | null> {
	const containerName = `doce-preview-${projectId}`;

	try {
		const container = await getContainerByName(containerName);
		if (!container) {
			return null;
		}

		const info = await container.inspect();
		if (!info.State.Running) {
			return null;
		}

		// Stream logs (stdout + stderr, follow mode)
		const logStream = await container.logs({
			follow: true,
			stdout: true,
			stderr: true,
			tail: 100, // Get last 100 lines on connect
			timestamps: false,
		});

		return logStream;
	} catch (error) {
		console.error(`Failed to stream logs for ${projectId}:`, error);
		return null;
	}
}
