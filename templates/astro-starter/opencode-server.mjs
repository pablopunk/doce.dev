import { createOpencode } from "@opencode-ai/sdk";

async function startOpencodeServer() {
  try {
    const instance = await createOpencode({
      port: 4096,
      hostname: "0.0.0.0",
      config: {},
    });
    console.log(`OpenCode server started at ${instance.server.url}`);
  } catch (error) {
    console.error("Failed to start OpenCode server:", error);
    // Don't throw, just log error to prevent breaking the app startup if port is in use
  }
}

startOpencodeServer();
