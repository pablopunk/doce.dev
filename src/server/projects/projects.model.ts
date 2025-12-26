import * as fs from "node:fs/promises";
import * as path from "node:path";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/server/db/client";
import { type NewProject, type Project, projects } from "@/server/db/schema";
import { logger } from "@/server/logger";

export type ProjectStatus = Project["status"];

interface OpencodeConfig {
	model?: string;
	small_model?: string;
	provider?: Record<string, unknown>;
	instructions?: string[];
	[key: string]: unknown;
}

interface ModelInfo {
	providerID: string;
	modelID: string;
}

/**
 * Load opencode.json configuration from a project directory.
 */
export async function loadOpencodeConfig(
	projectPath: string,
): Promise<OpencodeConfig | null> {
	try {
		const configPath = path.join(projectPath, "opencode.json");
		const content = await fs.readFile(configPath, "utf-8");
		return JSON.parse(content) as OpencodeConfig;
	} catch {
		logger.debug({ projectPath }, "Could not load opencode.json");
		return null;
	}
}

/**
 * Parse model string into components.
 * Handles both direct providers ("provider/model") and OpenRouter proxied models ("upstream/model").
 *
 * For OpenRouter, the format is "upstream_provider/model_name" (e.g., "anthropic/claude-haiku-4.5")
 * but it should be sent as providerID="openrouter", modelID="upstream_provider/model_name"
 *
 * @param modelString - The model string to parse
 * @param isOpenRouter - Whether this is for an OpenRouter-configured OpenCode instance
 * @returns ModelInfo with providerID and modelID, or null if invalid
 */
export function parseModelString(
	modelString: string,
	isOpenRouter = true,
): ModelInfo | null {
	try {
		if (isOpenRouter) {
			// For OpenRouter, the entire string is the modelID
			// OpenRouter proxy format: "upstream_provider/model_name"
			// e.g., "anthropic/claude-haiku-4.5" -> providerID="openrouter", modelID="anthropic/claude-haiku-4.5"
			return {
				providerID: "openrouter",
				modelID: modelString,
			};
		}

		// For direct providers, split on first "/" only
		const parts = modelString.split("/");
		if (parts.length < 2) {
			return null;
		}
		const providerID = parts[0];
		const modelID = parts.slice(1).join("/"); // Handle models with "/" in their name
		if (!providerID || !modelID) {
			return null;
		}
		return { providerID, modelID };
	} catch {
		return null;
	}
}

/**
 * Store the initial model configuration for a project.
 */
export async function storeProjectModel(
	projectId: string,
	model: ModelInfo,
): Promise<void> {
	await db
		.update(projects)
		.set({
			currentModelProviderID: model.providerID,
			currentModelID: model.modelID,
		})
		.where(eq(projects.id, projectId));
}

/**
 * Get the current model for a project.
 */
export async function getProjectModel(projectId: string): Promise<ModelInfo> {
	const project = await db.query.projects.findFirst({
		where: eq(projects.id, projectId),
	});

	if (project?.currentModelProviderID && project?.currentModelID) {
		return {
			providerID: project.currentModelProviderID,
			modelID: project.currentModelID,
		};
	}

	// Fallback to default model
	return {
		providerID: "openrouter",
		modelID: "google/gemini-2.5-flash",
	};
}

/**
 * Create a new project in the database.
 */
export async function createProject(data: NewProject): Promise<Project> {
	const result = await db.insert(projects).values(data).returning();
	const project = result[0];
	if (!project) {
		throw new Error("Failed to create project");
	}
	return project;
}

/**
 * Get a project by ID (excludes soft-deleted projects).
 */
export async function getProjectById(id: string): Promise<Project | null> {
	const result = await db
		.select()
		.from(projects)
		.where(and(eq(projects.id, id), isNull(projects.deletedAt)))
		.limit(1);

	return result[0] ?? null;
}

/**
 * Get a project by ID regardless of deletion status.
 */
export async function getProjectByIdIncludeDeleted(
	id: string,
): Promise<Project | null> {
	const result = await db
		.select()
		.from(projects)
		.where(eq(projects.id, id))
		.limit(1);

	return result[0] ?? null;
}

/**
 * Get all projects for a user (excludes soft-deleted projects and projects being deleted).
 */
export async function getProjectsByUserId(userId: string): Promise<Project[]> {
	return db
		.select()
		.from(projects)
		.where(
			and(
				eq(projects.ownerUserId, userId),
				isNull(projects.deletedAt),
				ne(projects.status, "deleting"),
			),
		)
		.orderBy(desc(projects.createdAt));
}

/**
 * Update a project's status.
 */
export async function updateProjectStatus(
	id: string,
	status: ProjectStatus,
): Promise<void> {
	await db.update(projects).set({ status }).where(eq(projects.id, id));
}

/**
 * Update project model.
 * Parses a model string (format: "provider/model") into components and stores them.
 */
export async function updateProjectModel(
	id: string,
	model: string | null,
): Promise<void> {
	let modelInfo = {
		providerID: null as string | null,
		modelID: null as string | null,
	};

	if (model) {
		const parsed = parseModelString(model);
		if (parsed) {
			modelInfo = parsed;
		}
	}

	await db
		.update(projects)
		.set({
			currentModelProviderID: modelInfo.providerID,
			currentModelID: modelInfo.modelID,
		})
		.where(eq(projects.id, id));
}

/**
 * Update the model field in opencode.json for a project.
 * This ensures the model persists when the OpenCode server reads the config.
 */
export async function updateOpencodeJsonModel(
	projectId: string,
	newModel: string,
): Promise<void> {
	const projectPath = path.join(process.cwd(), "data", "projects", projectId);
	const opencodeJsonPath = path.join(projectPath, "opencode.json");

	try {
		// Read existing config
		const content = await fs.readFile(opencodeJsonPath, "utf-8");
		const config = JSON.parse(content) as Record<string, unknown>;

		// Update the model field
		config.model = newModel;

		// Write back to file
		await fs.writeFile(opencodeJsonPath, JSON.stringify(config, null, 2));

		logger.debug({ projectId, newModel }, "Updated opencode.json model");
	} catch (error) {
		logger.error(
			{ projectId, newModel, error: String(error) },
			"Failed to update opencode.json model",
		);
		throw error;
	}
}

/**
 * Soft-delete a project by setting deletedAt.
 */
export async function softDeleteProject(id: string): Promise<void> {
	await db
		.update(projects)
		.set({ deletedAt: new Date() })
		.where(eq(projects.id, id));
}

/**
 * Hard-delete a project from the database.
 */
export async function hardDeleteProject(id: string): Promise<void> {
	await db.delete(projects).where(eq(projects.id, id));
}

/**
 * Check if a project belongs to a user.
 */
export async function isProjectOwnedByUser(
	projectId: string,
	userId: string,
): Promise<boolean> {
	const result = await db
		.select({ id: projects.id })
		.from(projects)
		.where(
			and(
				eq(projects.id, projectId),
				eq(projects.ownerUserId, userId),
				isNull(projects.deletedAt),
			),
		)
		.limit(1);

	return result.length > 0;
}

/**
 * Get all running projects (for shutdown/cleanup).
 */
export async function getRunningProjects(): Promise<Project[]> {
	return db
		.select()
		.from(projects)
		.where(and(eq(projects.status, "running"), isNull(projects.deletedAt)));
}

/**
 * Mark a project's initial prompt as sent.
 */
export async function markInitialPromptSent(id: string): Promise<void> {
	await db
		.update(projects)
		.set({ initialPromptSent: true })
		.where(eq(projects.id, id));
}

/**
 * Mark a project's initial prompt as completed (finished execution).
 */
export async function markInitialPromptCompleted(id: string): Promise<void> {
	await db
		.update(projects)
		.set({ initialPromptCompleted: true })
		.where(eq(projects.id, id));
}

/**
 * Update a project's bootstrap session ID.
 */
export async function updateBootstrapSessionId(
	id: string,
	sessionId: string,
): Promise<void> {
	await db
		.update(projects)
		.set({ bootstrapSessionId: sessionId })
		.where(eq(projects.id, id));
}

// ============================================================================
// Split Prompt Tracking Functions
// ============================================================================

/**
 * Update the init prompt message ID for a project.
 * This is set when the empty init prompt is created during session initialization.
 */
/**
 * Update the user prompt message ID for a project.
 * This is set when the user's actual prompt is sent.
 */
export async function updateUserPromptMessageId(
	id: string,
	messageId: string,
): Promise<void> {
	await db
		.update(projects)
		.set({ userPromptMessageId: messageId })
		.where(eq(projects.id, id));
}

/**
 * Mark the user prompt as completed (when it goes idle).
 * Also marks the legacy initialPromptCompleted flag for backward compatibility.
 */
export async function markUserPromptCompleted(id: string): Promise<void> {
	await db
		.update(projects)
		.set({
			userPromptCompleted: true,
			// Also update legacy flag for backward compatibility
			initialPromptCompleted: true,
		})
		.where(eq(projects.id, id));
}
