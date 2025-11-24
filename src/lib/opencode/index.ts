import type { OpencodeClient } from "@opencode-ai/sdk";
import { createOpencode, createOpencodeClient } from "@opencode-ai/sdk";
import { createLogger } from "@/lib/logger";

const logger = createLogger("opencode");

type OpencodeServer = {
	url: string;
	close(): void;
};

let opencodeInstance: {
	server: OpencodeServer;
	client: OpencodeClient;
} | null = null;
let clientOnlyInstance: OpencodeClient | null = null;
let serverStarting = false;

export async function getOpencodeServer(): Promise<{
	server: OpencodeServer;
	client: OpencodeClient;
}> {
	if (opencodeInstance) {
		return opencodeInstance;
	}

	// Prevent multiple simultaneous startup attempts
	if (serverStarting) {
		logger.info("OpenCode server already starting, waiting...");
		// Wait for the other startup to complete
		await new Promise((resolve) => setTimeout(resolve, 1000));
		if (opencodeInstance) {
			return opencodeInstance;
		}
	}

	serverStarting = true;
	logger.info("Starting OpenCode server...");

	try {
		const instance = await createOpencode({
			port: 4096,
			hostname: "127.0.0.1",
			config: {},
		});

		opencodeInstance = instance;
		logger.info(`OpenCode server started at ${instance.server.url}`);

		return instance;
	} catch (error) {
		const errorMsg = (error as Error).message.toLowerCase();

		// If server exited with code 1, it's likely a port conflict
		// Try to connect to existing server
		if (
			errorMsg.includes("server exited with code 1") ||
			errorMsg.includes("port 4096 in use") ||
			errorMsg.includes("failed to start server") ||
			errorMsg.includes("eaddrinuse")
		) {
			logger.warn(
				"Port 4096 appears to be in use, attempting to connect to existing OpenCode server",
			);
			try {
				const client = getOpencodeClient();
				logger.info("Testing connection to existing OpenCode server...");
				// Test if the server is responsive by listing sessions
				const result = await client.session.list({});
				logger.info(
					`Connected to existing OpenCode server at http://127.0.0.1:4096 (found ${result.data?.length || 0} sessions)`,
				);
				// Create a minimal server object for compatibility
				const fakeServer: OpencodeServer = {
					url: "http://127.0.0.1:4096",
					close: () => logger.info("Not closing external OpenCode server"),
				};
				opencodeInstance = { server: fakeServer, client };
				return opencodeInstance;
			} catch (clientError) {
				logger.error(
					"Failed to connect to existing OpenCode server",
					clientError as Error,
				);
				logger.error(`Client error details: ${JSON.stringify(clientError)}`);
			}
		}

		logger.error("Failed to start OpenCode server", error as Error);
		throw error;
	} finally {
		serverStarting = false;
	}
}

export function getOpencodeClient(): OpencodeClient {
	if (opencodeInstance) {
		return opencodeInstance.client;
	}

	if (!clientOnlyInstance) {
		logger.info("Creating OpenCode client (connecting to existing server)");
		clientOnlyInstance = createOpencodeClient({
			baseUrl: "http://127.0.0.1:4096",
		});
	}

	return clientOnlyInstance;
}

export async function closeOpencodeServer(): Promise<void> {
	if (opencodeInstance) {
		logger.info("Closing OpenCode server...");
		opencodeInstance.server.close();
		opencodeInstance = null;
	}
}

export async function syncAuthToOpencode(
	provider: string,
	apiKey: string | null,
): Promise<void> {
	if (!apiKey) {
		logger.debug(`No API key for provider ${provider}, skipping sync`);
		return;
	}

	try {
		const client = getOpencodeClient();
		await client.auth.set({
			path: { id: provider },
			body: { type: "api", key: apiKey },
		});
		logger.info(`Synced ${provider} API key to OpenCode`);
	} catch (error) {
		logger.error(
			`Failed to sync ${provider} API key to OpenCode`,
			error as Error,
		);
	}
}
