import * as net from "node:net";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { logger } from "@/server/logger";

// Port pools for different purposes
const BASE_PORT_MIN = 3000; // For production base ports (public-facing)
const BASE_PORT_MAX = 3999;
const VERSION_PORT_MIN = 5000; // For version-specific ports (internal)
const VERSION_PORT_MAX = 5999;

/**
 * Check if a port is currently allocated in the database
 */
async function isPortAllocated(port: number): Promise<boolean> {
	const result = await db
		.select({ id: schema.ports.id })
		.from(schema.ports)
		.where(eq(schema.ports.port, port))
		.limit(1);
	return result.length > 0;
}

/**
 * Check if a port of a specific type is allocated for a project
 */
async function isPortAllocatedForProject(
	port: number,
	portType: "base" | "version" | "dev",
	projectId?: string,
): Promise<boolean> {
	const conditions = [
		eq(schema.ports.port, port),
		eq(schema.ports.portType, portType),
	];

	if (projectId) {
		conditions.push(eq(schema.ports.projectId, projectId));
	}

	const result = await db
		.select({ id: schema.ports.id })
		.from(schema.ports)
		.where(and(...conditions))
		.limit(1);
	return result.length > 0;
}

/**
 * Register a port in the database
 */
async function registerPort(
	port: number,
	portType: "base" | "version" | "dev",
	projectId?: string,
	hash?: string,
): Promise<void> {
	const now = new Date();
	await db.insert(schema.ports).values({
		port,
		portType,
		projectId,
		hash,
		createdAt: now,
		updatedAt: now,
	});
	logger.debug({ port, portType, projectId }, "Registered port in database");
}

/**
 * Unregister a port from the database
 */
async function unregisterPort(port: number): Promise<void> {
	await db.delete(schema.ports).where(eq(schema.ports.port, port));
	logger.debug({ port }, "Unregistered port from database");
}

/**
 * Load all allocated ports from the database into memory sets
 * This is called on server startup to initialize the in-memory cache
 */
export async function initializePortTracking(): Promise<void> {
	logger.info("Initializing port tracking from database");
	const allPorts = await db
		.select({
			port: schema.ports.port,
			portType: schema.ports.portType,
		})
		.from(schema.ports);

	logger.info({ count: allPorts.length }, "Loaded port tracking from database");
}

/**
 * Find an available port by attempting to bind to a random port.
 * Uses the OS to find an available port by binding to port 0.
 */
export async function allocatePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();

		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address && typeof address === "object") {
				const port = address.port;
				server.close(() => {
					logger.debug({ port }, "Allocated port");
					resolve(port);
				});
			} else {
				server.close();
				reject(new Error("Failed to get port from server address"));
			}
		});

		server.on("error", (err) => {
			reject(err);
		});
	});
}

/**
 * Check if a specific port is available.
 */
export async function isPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = net.createServer();

		server.listen(port, "127.0.0.1", () => {
			server.close(() => resolve(true));
		});

		server.on("error", () => {
			resolve(false);
		});
	});
}

/**
 * Try to allocate a specific port, or find a new one if it's taken.
 * Useful when restarting a project that had ports assigned.
 */
export async function ensurePortAvailable(
	preferredPort: number,
): Promise<number> {
	const available = await isPortAvailable(preferredPort);
	if (available) {
		return preferredPort;
	}

	logger.warn(
		{ preferredPort },
		"Preferred port not available, allocating new one",
	);
	return allocatePort();
}

/**
 * Allocate a port from the BASE port pool (3000-3999).
 * Used once per project for the public-facing production port.
 * Deterministic and reusable - always returns the same port for the same projectId.
 */
export async function allocateProjectBasePort(
	projectId: string,
): Promise<number> {
	// Use projectId hash to deterministically assign base port
	let hash = 0;
	for (let i = 0; i < projectId.length; i++) {
		const char = projectId.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}

	const offset = Math.abs(hash) % (BASE_PORT_MAX - BASE_PORT_MIN + 1);
	const basePort = BASE_PORT_MIN + offset;

	// Check if port is already allocated for this project
	const alreadyAllocated = await isPortAllocatedForProject(
		basePort,
		"base",
		projectId,
	);
	if (alreadyAllocated) {
		logger.info({ projectId, basePort }, "Using existing allocated base port");
		return basePort;
	}

	// Check if available, if not, find an alternative
	const available = await isPortAvailable(basePort);
	if (!available) {
		logger.warn(
			{ projectId, basePort },
			"Preferred base port not available, finding alternative",
		);
		// Find next available port in the range
		for (let port = basePort + 1; port <= BASE_PORT_MAX; port++) {
			const isDbAllocated = await isPortAllocated(port);
			if (!isDbAllocated) {
				const isAvail = await isPortAvailable(port);
				if (isAvail) {
					await registerPort(port, "base", projectId);
					logger.info({ projectId, basePort: port }, "Allocated base port");
					return port;
				}
			}
		}
		throw new Error(
			`No available base ports in range ${BASE_PORT_MIN}-${BASE_PORT_MAX}`,
		);
	}

	await registerPort(basePort, "base", projectId);
	logger.info({ projectId, basePort }, "Allocated base port");
	return basePort;
}

/**
 * Derive a version port from a hash (deterministic).
 * Multiple calls with the same hash and projectId will return the same port.
 * Allows version containers to use consistent ports.
 */
export function deriveVersionPort(projectId: string, hash: string): number {
	// Combine projectId and hash for deterministic port calculation
	const combined = `${projectId}:${hash}`;
	let hashValue = 0;
	for (let i = 0; i < combined.length; i++) {
		const char = combined.charCodeAt(i);
		hashValue = (hashValue << 5) - hashValue + char;
		hashValue = hashValue & hashValue; // Convert to 32bit integer
	}

	const offset =
		Math.abs(hashValue) % (VERSION_PORT_MAX - VERSION_PORT_MIN + 1);
	const versionPort = VERSION_PORT_MIN + offset;

	logger.debug(
		{
			projectId,
			hash: hash.slice(0, 8),
			versionPort,
		},
		"Derived version port",
	);

	return versionPort;
}

/**
 * Register a version port as allocated.
 * Should be called when a version is created to prevent future conflicts.
 */
export async function registerVersionPort(
	projectId: string,
	hash: string,
	versionPort: number,
): Promise<void> {
	await registerPort(versionPort, "version", projectId, hash);
}

/**
 * Register a base port as allocated.
 * Should be called when a project is created.
 */
export async function registerBasePort(basePort: number): Promise<void> {
	await registerPort(basePort, "base");
}

/**
 * Unregister a port from the allocated set.
 * Call when port is no longer in use.
 */
export async function unregisterVersionPort(
	versionPort: number,
): Promise<void> {
	await unregisterPort(versionPort);
}

/**
 * Allocate two ports for a project: devPort (preview) and opencodePort.
 */
export async function allocateProjectPorts(): Promise<{
	devPort: number;
	opencodePort: number;
}> {
	const devPort = await allocatePort();
	const opencodePort = await allocatePort();

	await registerPort(devPort, "dev");
	await registerPort(opencodePort, "dev");

	logger.info({ devPort, opencodePort }, "Allocated project ports");

	return { devPort, opencodePort };
}
