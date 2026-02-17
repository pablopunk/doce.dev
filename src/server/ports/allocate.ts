import * as net from "node:net";
import { logger } from "@/server/logger";

// Port pools for different purposes
const BASE_PORT_MIN = 3000; // For production base ports (public-facing)
const BASE_PORT_MAX = 3999;
const VERSION_PORT_MIN = 5000; // For version-specific ports (internal)
const VERSION_PORT_MAX = 5999;

// Track allocated ports
const allocatedBasePorts = new Set<number>();
const allocatedVersionPorts = new Set<number>();
const allocatedDevPorts = new Set<number>();

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

	// Check if available, if not, find an alternative
	const available = await isPortAvailable(basePort);
	if (!available) {
		logger.warn(
			{ projectId, basePort },
			"Preferred base port not available, finding alternative",
		);
		// Find next available port in the range
		for (let port = basePort + 1; port <= BASE_PORT_MAX; port++) {
			if (!allocatedBasePorts.has(port)) {
				const isAvail = await isPortAvailable(port);
				if (isAvail) {
					allocatedBasePorts.add(port);
					logger.info({ projectId, basePort: port }, "Allocated base port");
					return port;
				}
			}
		}
		throw new Error(
			`No available base ports in range ${BASE_PORT_MIN}-${BASE_PORT_MAX}`,
		);
	}

	allocatedBasePorts.add(basePort);
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
export function registerVersionPort(
	_projectId: string,
	_hash: string,
	versionPort: number,
): void {
	allocatedVersionPorts.add(versionPort);
	logger.debug({ versionPort }, "Registered version port");
}

/**
 * Register a base port as allocated.
 * Should be called when a project is created.
 */
export function registerBasePort(basePort: number): void {
	allocatedBasePorts.add(basePort);
	logger.debug({ basePort }, "Registered base port");
}

/**
 * Unregister a port from the allocated set.
 * Call when port is no longer in use.
 */
export function unregisterVersionPort(versionPort: number): void {
	allocatedVersionPorts.delete(versionPort);
	logger.debug({ versionPort }, "Unregistered version port");
}

/**
 * Allocate a deterministic production port for a project (8000-9999).
 * The port is derived from the project ID hash, ensuring consistency.
 */
export async function allocateProjectProductionPort(
	projectId: string,
): Promise<number> {
	const PROD_PORT_MIN = 8000;
	const PROD_PORT_MAX = 9999;

	// Deterministic hash-based port allocation
	let hash = 0;
	for (let i = 0; i < projectId.length; i++) {
		const char = projectId.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}

	const offset = Math.abs(hash) % (PROD_PORT_MAX - PROD_PORT_MIN + 1);
	const productionPort = PROD_PORT_MIN + offset;

	const available = await isPortAvailable(productionPort);
	if (!available) {
		logger.warn(
			{ projectId, productionPort },
			"Preferred production port not available, finding alternative",
		);
		// Find next available port in the range
		for (let port = productionPort + 1; port <= PROD_PORT_MAX; port++) {
			const isAvail = await isPortAvailable(port);
			if (isAvail) {
				allocatedDevPorts.add(port);
				logger.info(
					{ projectId, productionPort: port },
					"Allocated production port",
				);
				return port;
			}
		}
		throw new Error(
			`No available production ports in range ${PROD_PORT_MIN}-${PROD_PORT_MAX}`,
		);
	}

	allocatedDevPorts.add(productionPort);
	logger.info({ projectId, productionPort }, "Allocated production port");
	return productionPort;
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

	allocatedDevPorts.add(devPort);
	allocatedDevPorts.add(opencodePort);

	logger.info({ devPort, opencodePort }, "Allocated project ports");

	return { devPort, opencodePort };
}
