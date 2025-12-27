import { execSync } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";

const NGINX_CONFIG_DIR = "/etc/nginx/conf.d";
const NGINX_DOCE_CONFIG = path.join(NGINX_CONFIG_DIR, "doce-production.conf");

/**
 * Generate nginx upstream configuration for a production version
 */
function generateUpstream(
	projectId: string,
	hash: string,
	versionPort: number,
): string {
	const upstreamName = `doce_prod_${projectId.slice(0, 8)}_${hash}`;
	return `upstream ${upstreamName} {
  server 127.0.0.1:${versionPort};
}`;
}

/**
 * Generate nginx server block for a project's production base port
 */
function generateServerBlock(
	projectId: string,
	basePort: number,
	activeHash: string,
): string {
	const upstreamName = `doce_prod_${projectId.slice(0, 8)}_${activeHash}`;
	return `server {
  listen ${basePort};
  server_name localhost;

  location / {
    proxy_pass http://${upstreamName};
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}`;
}

/**
 * Internal config storage - keeps track of what's configured
 */
interface NginxProjectConfig {
	projectId: string;
	basePort: number;
	activeHash: string;
	upstreams: Map<string, number>; // hash -> port mapping
}

// In-memory cache of nginx configurations (simplified)
// In production, this could be stored in a config file or database
const projectConfigs = new Map<string, NginxProjectConfig>();

/**
 * Get active version port for a project
 */
function getActiveVersionPort(config: NginxProjectConfig): number {
	const port = config.upstreams.get(config.activeHash);
	if (!port) {
		throw new Error(`Active hash ${config.activeHash} not found in upstreams`);
	}
	return port;
}

/**
 * Initialize nginx configuration for a project.
 * Creates the upstream and server blocks needed for routing.
 * Safe to call multiple times - only updates if needed.
 */
export async function initializeProjectNginxConfig(
	projectId: string,
	basePort: number,
	hash: string,
	versionPort: number,
): Promise<void> {
	try {
		// Create or get project config
		if (!projectConfigs.has(projectId)) {
			projectConfigs.set(projectId, {
				projectId,
				basePort,
				activeHash: hash,
				upstreams: new Map([[hash, versionPort]]),
			});
		} else {
			// Update existing config
			const config = projectConfigs.get(projectId);
			if (config) {
				config.basePort = basePort;
				config.activeHash = hash;
				config.upstreams.set(hash, versionPort);
			}
		}

		await writeNginxConfig();
		await reloadNginx();

		logger.info(
			{
				projectId,
				basePort,
				hash: hash.slice(0, 8),
				versionPort,
			},
			"Initialized nginx config for project",
		);
	} catch (err) {
		logger.error(
			{
				error: err,
				projectId,
				basePort,
			},
			"Failed to initialize nginx config",
		);
		throw err;
	}
}

/**
 * Update nginx routing to point to a different version.
 * Instant rollback/switching between versions.
 */
export async function updateProjectNginxRouting(
	projectId: string,
	newHash: string,
	newVersionPort: number,
): Promise<void> {
	try {
		const config = projectConfigs.get(projectId);
		if (!config) {
			throw new Error(`No nginx config found for project ${projectId}`);
		}

		const previousHash = config.activeHash;

		// Ensure we have the upstream block for this version
		if (!config.upstreams.has(newHash)) {
			config.upstreams.set(newHash, newVersionPort);
		}

		// Update active routing
		config.activeHash = newHash;

		await writeNginxConfig();
		await reloadNginx();

		logger.info(
			{
				projectId,
				previousHash: previousHash.slice(0, 8),
				newHashLog: newHash.slice(0, 8),
				newVersionPort,
			},
			"Updated nginx routing for project",
		);
	} catch (err) {
		logger.error(
			{
				error: err,
				projectId,
				newHashLog: newHash,
			},
			"Failed to update nginx routing",
		);
		throw err;
	}
}

/**
 * Register a version in nginx upstreams without making it active.
 * Allows previewing old versions by accessing their port directly.
 */
export async function registerVersionInNginx(
	projectId: string,
	hash: string,
	versionPort: number,
): Promise<void> {
	try {
		const config = projectConfigs.get(projectId);
		if (!config) {
			throw new Error(`No nginx config found for project ${projectId}`);
		}

		if (!config.upstreams.has(hash)) {
			config.upstreams.set(hash, versionPort);
			await writeNginxConfig();
			await reloadNginx();
		}

		logger.debug(
			{
				projectId,
				hash: hash.slice(0, 8),
				versionPort,
			},
			"Registered version in nginx",
		);
	} catch (err) {
		logger.error(
			{
				error: err,
				projectId,
				hash,
			},
			"Failed to register version in nginx",
		);
		throw err;
	}
}

/**
 * Remove a version's upstream from nginx.
 * Should only be called after the container is stopped.
 */
export async function unregisterVersionInNginx(
	projectId: string,
	hash: string,
): Promise<void> {
	try {
		const config = projectConfigs.get(projectId);
		if (!config) {
			return; // Nothing to do if project not configured
		}

		config.upstreams.delete(hash);

		// Don't make an inactive version active
		if (config.activeHash === hash && config.upstreams.size > 0) {
			// Switch to any other available version
			const firstEntry = Array.from(config.upstreams.entries())[0];
			if (firstEntry) {
				const [nextHash] = firstEntry;
				config.activeHash = nextHash;
				logger.warn(
					{
						projectId,
						previousHash: hash.slice(0, 8),
						newHashLog: nextHash.slice(0, 8),
					},
					"Active version was unregistered, switched to another",
				);
			}
		}

		await writeNginxConfig();
		await reloadNginx();

		logger.info(
			{
				projectId,
				hash: hash.slice(0, 8),
			},
			"Unregistered version from nginx",
		);
	} catch (err) {
		logger.error(
			{
				error: err,
				projectId,
				hash,
			},
			"Failed to unregister version from nginx",
		);
		throw err;
	}
}

/**
 * Completely remove a project's nginx configuration.
 * Call when project is deleted.
 */
export async function removeProjectNginxConfig(
	projectId: string,
): Promise<void> {
	try {
		projectConfigs.delete(projectId);
		await writeNginxConfig();
		await reloadNginx();

		logger.info({ projectId }, "Removed nginx config for project");
	} catch (err) {
		logger.error(
			{
				error: err,
				projectId,
			},
			"Failed to remove nginx config",
		);
		throw err;
	}
}

/**
 * Write the full nginx configuration file.
 * Generates all upstreams and server blocks from project configs.
 */
async function writeNginxConfig(): Promise<void> {
	const configLines: string[] = [];

	// Generate all upstreams
	for (const config of projectConfigs.values()) {
		for (const [hash, port] of config.upstreams) {
			configLines.push(generateUpstream(config.projectId, hash, port));
			configLines.push(""); // blank line
		}
	}

	// Generate all server blocks
	for (const config of projectConfigs.values()) {
		configLines.push(
			generateServerBlock(config.projectId, config.basePort, config.activeHash),
		);
		configLines.push(""); // blank line
	}

	const fullConfig = configLines.join("\n");

	try {
		// Try to write to /etc/nginx/conf.d (requires root or running as nginx user)
		try {
			await fs.writeFile(NGINX_DOCE_CONFIG, fullConfig, "utf-8");
			logger.debug(
				{ configPath: NGINX_DOCE_CONFIG },
				"Wrote nginx config file",
			);
		} catch (err) {
			// If we can't write to /etc/nginx, log a warning but don't fail
			// This might happen if not running as root or if nginx is not installed
			logger.warn(
				{
					error: err,
					configPath: NGINX_DOCE_CONFIG,
				},
				"Could not write to /etc/nginx/conf.d - nginx might not be available",
			);
		}
	} catch (err) {
		logger.error(
			{
				error: err,
			},
			"Failed to write nginx config",
		);
		throw err;
	}
}

/**
 * Reload nginx to apply configuration changes.
 * Uses `nginx -s reload` which is graceful.
 */
async function reloadNginx(): Promise<void> {
	try {
		// Check if nginx is running and reload it
		try {
			execSync("nginx -s reload", {
				stdio: "pipe",
				timeout: 5000,
			});
			logger.debug("Nginx config reloaded successfully");
		} catch (err: unknown) {
			const error = err as { status?: number; signal?: string };
			// nginx -s reload will fail if nginx is not running, which is okay during initial setup
			if (error.status === 1 || error.signal === "SIGTERM") {
				logger.warn(
					{
						error: err,
					},
					"Nginx not running yet - will start on first deployment",
				);
			} else {
				throw err;
			}
		}
	} catch (err) {
		logger.error(
			{
				error: err,
			},
			"Failed to reload nginx",
		);
		// Don't throw - nginx might not be running yet, which is okay
	}
}

/**
 * Get the current configuration state for debugging.
 */
export function getProjectNginxConfig(projectId: string):
	| {
			projectId: string;
			basePort: number;
			activeHash: string;
			activeVersionPort: number;
			versions: Array<{ hash: string; port: number }>;
	  }
	| undefined {
	const config = projectConfigs.get(projectId);
	if (!config) {
		return undefined;
	}

	const activePort = getActiveVersionPort(config);

	return {
		projectId: config.projectId,
		basePort: config.basePort,
		activeHash: config.activeHash,
		activeVersionPort: activePort,
		versions: Array.from(config.upstreams.entries()).map(([hash, port]) => ({
			hash,
			port,
		})),
	};
}
