import type { APIRoute } from "astro";
import { readProjectFile, writeProjectFiles } from "@/lib/file-system";

// Parse .env file content into key-value object
function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = content.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      env[key] = value;
    }
  }
  
  return env;
}

// Convert key-value object to .env file format
function stringifyEnvFile(env: Record<string, string>): string {
  const lines: string[] = [];
  
  for (const [key, value] of Object.entries(env)) {
    // Quote values that contain spaces or special characters
    const needsQuotes = /[\s#]/.test(value);
    const quotedValue = needsQuotes ? `"${value}"` : value;
    lines.push(`${key}=${quotedValue}`);
  }
  
  return lines.join("\n") + "\n";
}

export const GET: APIRoute = async ({ params }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    // Try to read .env file
    const envContent = await readProjectFile(id, ".env");
    
    if (!envContent) {
      return Response.json({ env: {} });
    }
    
    const env = parseEnvFile(envContent);
    return Response.json({ env });
  } catch (error) {
    console.error("Failed to read env file:", error);
    return Response.json({ error: "Failed to read environment variables" }, { status: 500 });
  }
};

export const POST: APIRoute = async ({ params, request }) => {
  const id = params.id;
  if (!id) {
    return Response.json({ error: "Project id is required" }, { status: 400 });
  }

  try {
    const { env } = await request.json();
    
    if (!env || typeof env !== "object") {
      return Response.json({ error: "Invalid env data" }, { status: 400 });
    }

    // Convert to .env format
    const envContent = stringifyEnvFile(env);
    
    // Write .env file
    await writeProjectFiles(id, [{ path: ".env", content: envContent }]);
    
    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to write env file:", error);
    return Response.json({ error: "Failed to save environment variables" }, { status: 500 });
  }
};
