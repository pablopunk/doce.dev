import * as fs from "node:fs/promises";
import * as path from "node:path";
import { logger } from "@/server/logger";
import { db } from "@/server/db/client";
import { userSettings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { generateProjectName } from "@/server/settings/openrouter";
import { allocateProjectPorts } from "@/server/ports/allocate";
import { generateUniqueSlug } from "@/server/projects/slug";
import { createProject } from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { enqueueDockerComposeUp } from "../enqueue";

// Paths relative to project root
const DATA_DIR = "data";
const PROJECTS_DIR = "projects";
const TEMPLATE_DIR = "templates/astro-starter";

function getDataPath(): string {
  return path.join(process.cwd(), DATA_DIR);
}

function getProjectsPath(): string {
  return path.join(getDataPath(), PROJECTS_DIR);
}

function getTemplatePath(): string {
  return path.join(process.cwd(), TEMPLATE_DIR);
}

function getProjectPath(projectId: string): string {
  return path.join(getProjectsPath(), projectId);
}

function getProjectRelativePath(projectId: string): string {
  return `${DATA_DIR}/${PROJECTS_DIR}/${projectId}`;
}

export async function handleProjectCreate(ctx: QueueJobContext): Promise<void> {
  const payload = parsePayload("project.create", ctx.job.payloadJson);
  const { projectId, ownerUserId, prompt, model } = payload;

  logger.info({ projectId, prompt: prompt.slice(0, 100) }, "Creating project");

  try {
    await ctx.throwIfCancelRequested();

    // Get user's OpenRouter API key
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, ownerUserId))
      .limit(1);

    const openrouterApiKey = settings[0]?.openrouterApiKey;
    if (!openrouterApiKey) {
      throw new Error("User has no OpenRouter API key configured");
    }

    await ctx.throwIfCancelRequested();

    // Generate project name using AI
    const name = await generateProjectName(openrouterApiKey, prompt);
    logger.debug({ projectId, name }, "Generated project name");

    await ctx.throwIfCancelRequested();

    // Generate unique slug
    const slug = await generateUniqueSlug(name);
    logger.debug({ projectId, slug }, "Generated unique slug");

    // Allocate ports
    const { devPort, opencodePort } = await allocateProjectPorts();
    logger.debug({ projectId, devPort, opencodePort }, "Allocated ports");

    await ctx.throwIfCancelRequested();

    // Get paths
    const projectPath = getProjectPath(projectId);
    const relativePath = getProjectRelativePath(projectId);

    // Ensure projects directory exists
    await fs.mkdir(getProjectsPath(), { recursive: true });

    // Copy template to project directory
    await copyTemplate(projectPath);
    logger.debug({ projectId, projectPath }, "Copied template");

    await ctx.throwIfCancelRequested();

     // Write .env file with ports
     await writeProjectEnv(projectPath, devPort, opencodePort, openrouterApiKey);
     logger.debug({ projectId, devPort, opencodePort }, "Wrote .env file");

     // Update opencode.json with the selected model
     if (model) {
       await updateOpencodeJsonWithModel(projectPath, model);
       logger.debug({ projectId, model }, "Updated opencode.json with model");
     }

     // Create logs directory
     await fs.mkdir(path.join(projectPath, "logs"), { recursive: true });

     await ctx.throwIfCancelRequested();

     // Create DB record
     await createProject({
       id: projectId,
       ownerUserId,
       createdAt: new Date(),
       name,
       slug,
       prompt,
       model,
       devPort,
       opencodePort,
       status: "created",
       pathOnDisk: relativePath,
     });

    logger.info({ projectId, name, slug }, "Created project in database");

    // Enqueue next step: docker compose up
    await enqueueDockerComposeUp({ projectId, reason: "bootstrap" });
    logger.debug({ projectId }, "Enqueued docker.composeUp");
    } catch (error) {
      throw error;
    }
}

async function copyTemplate(targetPath: string): Promise<void> {
  const templatePath = getTemplatePath();

  try {
    await fs.access(templatePath);
  } catch {
    throw new Error(`Template not found at ${templatePath}`);
  }

  await copyDir(templatePath, targetPath);
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function writeProjectEnv(
  projectPath: string,
  devPort: number,
  opencodePort: number,
  openrouterApiKey: string
): Promise<void> {
  const envContent = `# Generated by doce.dev
DEV_PORT=${devPort}
OPENCODE_PORT=${opencodePort}
OPENROUTER_API_KEY=${openrouterApiKey}
`;

  await fs.writeFile(path.join(projectPath, ".env"), envContent);
}

/**
 * Update opencode.json with the selected model.
 * If the model is in the format "provider/model-id", it will be set as the model field.
 */
async function updateOpencodeJsonWithModel(
  projectPath: string,
  model: string
): Promise<void> {
  const opencodeJsonPath = path.join(projectPath, "opencode.json");

  try {
    // Read existing config
    const content = await fs.readFile(opencodeJsonPath, "utf-8");
    const config = JSON.parse(content);

    // Update the model field
    config.model = model;

    // Write back to file
    await fs.writeFile(opencodeJsonPath, JSON.stringify(config, null, 2));
  } catch (error) {
    logger.warn(
      { projectPath, model, error: String(error) },
      "Failed to update opencode.json with model"
    );
    // Don't throw - this is not a critical failure
  }
}
