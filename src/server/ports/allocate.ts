import * as net from "node:net";
import { logger } from "@/server/logger";

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
 * Allocate two ports for a project: devPort (preview) and opencodePort.
 */
export async function allocateProjectPorts(): Promise<{
  devPort: number;
  opencodePort: number;
}> {
  const devPort = await allocatePort();
  const opencodePort = await allocatePort();

  logger.info({ devPort, opencodePort }, "Allocated project ports");

  return { devPort, opencodePort };
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
  preferredPort: number
): Promise<number> {
  const available = await isPortAvailable(preferredPort);
  if (available) {
    return preferredPort;
  }

  logger.warn(
    { preferredPort },
    "Preferred port not available, allocating new one"
  );
  return allocatePort();
}
