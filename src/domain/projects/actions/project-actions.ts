import { defineAction, ActionError } from "astro:actions";
import { z } from "astro:schema";
import { generateText } from "ai";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Project } from "@/domain/projects/models/project";
import { generateDefaultProjectStructure } from "@/domain/projects/lib/code-generator";
import {
	createPreviewContainer,
	createDeploymentContainer,
	getPreviewState,
	stopPreviewForProject,
	listProjectContainers,
	stopContainer,
	removeContainer,
} from "@/lib/docker";
import {
	deleteProjectFiles,
	listProjectFiles,
	readProjectFile,
	writeProjectFiles,
	listProjectSrcFiles,
	readProjectSrcFile,
} from "@/lib/file-system";

import { copyTemplateToProject } from "@/domain/projects/lib/template-generator";
import { LLMConfig } from "@/domain/llms/models/llm-config";
import { Conversation } from "@/domain/conversations/models/conversation";
import { Deployment } from "@/domain/system/models/system";
import { publishPreviewStatus } from "@/lib/preview-status-bus";

// Helper functions
function getTemplateAgentsContent(): string {
	try {
		const agentsPath = join(process.cwd(), "templates", "astro", "AGENTS.md");
		return readFileSync(agentsPath, "utf-8");
	} catch (error) {
		console.error("Failed to read AGENTS.md:", error);
		throw new Error("Template AGENTS.md file not found");
	}
}

function parseEnvFile(content: string): Record<string, string> {
	const env: Record<string, string> = {};
	const lines = content.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const match = trimmed.match(/^([^=]+)=(.*)$/);
		if (match) {
			const key = match[1].trim();
			let value = match[2].trim();

			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			env[key] = value;
		}
	}

	return env;
}

function stringifyEnvFile(env: Record<string, string>): string {
	const lines: string[] = [];

	for (const [key, value] of Object.entries(env)) {
		const needsQuotes = /[\s#]/.test(value);
		const quotedValue = needsQuotes ? `"${value}"` : value;
		lines.push(`${key}=${quotedValue}`);
	}

	return lines.join("\n") + "\n";
}

// Track active project sessions with timeouts
const activeProjects = new Map<string, NodeJS.Timeout>();
const INACTIVITY_TIMEOUT = 60000; // 60 seconds

export const server = {
	// GET /api/projects
	getProjects: defineAction({
		handler: async () => {
			const projects = await Project.getAll();
			return projects;
		},
	}),

	// POST /api/projects
	createProject: defineAction({
		input: z.object({
			name: z.string().optional(),
			description: z.string().optional(),
			prompt: z.string().optional(),
		}),
		handler: async ({ name, description, prompt }) => {
			let projectName = name;
			const projectDescription = description || prompt;

			// If a prompt is provided, generate project name with AI first
			if (prompt && !name) {
				try {
					const model = LLMConfig.getAIModel();

					const nameResult = await generateText({
						model,
						system: `You generate concise, descriptive project names. Return ONLY the project name, nothing else. Keep it short (1-4 words) and SEO friendly.`,
						prompt: `Generate a project name for the following description: ${prompt}`,
					});

					projectName = nameResult.text
						.trim()
						.toLowerCase()
						.replace(/[^a-z0-9-]/g, "-")
						.replace(/-+/g, "-");
				} catch (error) {
					console.error("Failed to generate project name:", error);
					projectName = prompt
						.slice(0, 50)
						.toLowerCase()
						.replace(/[^a-z0-9-]/g, "-")
						.replace(/-+/g, "-");
				}
			}

			const projectResult = await Project.create(
				projectName || "new-project",
				projectDescription,
			);

			// If a prompt is provided, copy full template and save initial user message
			// The chat interface will handle the generation after redirect
			if (prompt) {
				try {
					console.log(`Copying full template for project ${projectResult.id}`);
					const templateFiles = await copyTemplateToProject("astro");

					// Write all template files - AI will modify as needed (filesystem only)
					await writeProjectFiles(projectResult.id, templateFiles);
					console.log(`Full template copied: ${templateFiles.length} files`);

					// Create conversation and save initial user prompt
					const aiModelId = LLMConfig.getAIModelId();
					Conversation.createWithInitialMessage(
						projectResult.id,
						prompt,
						aiModelId,
					);

					console.log(
						`Project ${projectResult.id} created with initial prompt. Generation will start when user visits project page.`,
					);
				} catch (error) {
					console.error("Failed to setup initial project structure:", error);
				}
			}

			return projectResult;
		},
	}),

	// GET /api/projects/[id]
	getProject: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			const project = await Project.getById(id);

			if (!project) {
				throw new ActionError({
					code: "NOT_FOUND",
					message: "Project not found",
				});
			}

			return project;
		},
	}),

	// DELETE /api/projects/[id]
	deleteProject: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const containers = await listProjectContainers(id);
				for (const container of containers) {
					await stopContainer(container.Id);
					await removeContainer(container.Id);
				}

				await deleteProjectFiles(id);
				await Project.delete(id);

				return { success: true };
			} catch (error) {
				console.error("Failed to delete project:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete project",
				});
			}
		},
	}),

	// GET /api/projects/[id]/files
	getFiles: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			// For the code browser we only return files under src/ to keep the
			// payload small and avoid walking build output and dependencies.
			const filesystem = await listProjectSrcFiles(id);
			return { files: filesystem };
		},
	}),

	// GET /api/projects/[id]/file
	getFileContent: defineAction({
		input: z.object({
			id: z.string(),
			path: z.string(), // src-relative path, e.g. "src/pages/index.astro"
		}),
		handler: async ({ id, path }) => {
			const content = await readProjectSrcFile(id, path);
			if (content == null) {
				throw new ActionError({
					code: "NOT_FOUND",
					message: "File not found",
				});
			}
			return { path, content };
		},
	}),

	// POST /api/projects/[id]/generate
	generateProject: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const files = await generateDefaultProjectStructure();
				// Write to filesystem only (single source of truth)
				await writeProjectFiles(id, files);

				return { success: true, filesCreated: files.length };
			} catch (error) {
				console.error("Failed to generate project:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to generate project",
				});
			}
		},
	}),

	// POST /api/projects/[id]/preview
	createPreview: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const project = await Project.getById(id);
				if (!project) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Project not found",
					});
				}

				// Notify clients that preview creation is requested
				publishPreviewStatus(id, { status: "creating" });

				// Check if preview is already running
				const existingState = await getPreviewState(id);
				if (existingState) {
					console.log(
						`Preview already running for ${id}, syncing DB with Docker state`,
					);

					await Project.updateFields(id, {
						previewUrl: existingState.url,
						status: "preview",
					});

					// Notify clients
					publishPreviewStatus(id, {
						status: "running",
						previewUrl: existingState.url,
					});

					return {
						success: true,
						containerId: existingState.containerId,
						url: existingState.url,
						port: existingState.port,
						reused: true,
					};
				}

				// Create new preview container
				try {
					// publish 'starting' so clients show the starting UI while compose runs
					try {
						publishPreviewStatus(id, { status: "starting", previewUrl: null });
					} catch (e) {
						/* best-effort */
					}

					const { containerId, url, port } = await createPreviewContainer(id);

					await Project.updateFields(id, {
						previewUrl: url,
						status: "preview",
					});

					// publish running
					try {
						publishPreviewStatus(id, { status: "running", previewUrl: url });
					} catch (e) {
						/* best-effort */
					}

					return {
						success: true,
						containerId,
						url,
						port,
						reused: false,
					};
				} catch (err) {
					// Publish failure to clients
					try {
						publishPreviewStatus(id, {
							status: "failed",
							previewUrl: null,
							error: err instanceof Error ? err.message : String(err),
						});
					} catch (e) {
						/* best-effort */
					}
					throw err;
				}
			} catch (error) {
				console.error("Failed to create preview:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create preview environment",
				});
			}
		},
	}),

	// GET /api/projects/[id]/preview
	getPreviewStatus: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const project = await Project.getById(id);
				if (!project) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Project not found",
					});
				}

				// Always check Docker state first (source of truth)
				const dockerState = await getPreviewState(id);

				if (dockerState) {
					// Sync DB if out of sync
					if (project.previewUrl !== dockerState.url) {
						console.log(
							`Syncing DB for ${id}: ${project.previewUrl} -> ${dockerState.url}`,
						);
						await Project.updateFields(id, {
							previewUrl: dockerState.url,
							status: "preview",
						});
					}

					return {
						url: dockerState.url,
						status: "running" as const,
						port: dockerState.port,
					};
				}

				// No container running - clear stale DB data
				if (project.previewUrl) {
					console.log(`Clearing stale preview URL for ${id}`);
					await Project.updateFields(id, {
						previewUrl: null,
						status: "draft",
					});
				}

				return { status: "not-created" as const };
			} catch (error) {
				console.error("Failed to get preview status:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get preview status",
				});
			}
		},
	}),

	// DELETE /api/projects/[id]/preview
	stopPreview: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				await stopPreviewForProject(id);

				await Project.updateFields(id, {
					previewUrl: null,
					status: "draft",
				});

				// Notify clients
				try {
					publishPreviewStatus(id, { status: "not-created", previewUrl: null });
				} catch (e) {
					/* best-effort */
				}

				return { success: true };
			} catch (error) {
				console.error("Failed to delete preview:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete preview",
				});
			}
		},
	}),

	// POST /api/projects/[id]/preview/restart
	restartPreview: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const project = await Project.getById(id);
				if (!project) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Project not found",
					});
				}

				// Stop the preview first
				console.log(`Restarting preview for ${id}: stopping container...`);
				await stopPreviewForProject(id);

				// Wait a bit for Docker cleanup
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Start the preview again
				console.log(`Restarting preview for ${id}: starting container...`);
				// Let clients know we're starting a fresh container
				try {
					publishPreviewStatus(id, { status: "starting", previewUrl: null });
				} catch (e) {
					/* best-effort */
				}

				const { containerId, url, port } = await createPreviewContainer(id);

				await Project.updateFields(id, {
					previewUrl: url,
					status: "preview",
				});

				// Container is back up and running
				try {
					publishPreviewStatus(id, { status: "running", previewUrl: url });
				} catch (e) {
					/* best-effort */
				}

				return {
					success: true,
					containerId,
					url,
					port,
				};
			} catch (error) {
				console.error("Failed to restart preview:", error);
				// Surface failure to clients as well
				try {
					publishPreviewStatus(id, {
						status: "failed",
						previewUrl: null,
						error: error instanceof Error ? error.message : String(error),
					});
				} catch (e) {
					/* best-effort */
				}
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to restart preview",
				});
			}
		},
	}),

	// POST /api/projects/[id]/lifecycle (heartbeat)
	sendHeartbeat: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				// Clear existing timeout if any
				const existingTimeout = activeProjects.get(id);
				if (existingTimeout) {
					clearTimeout(existingTimeout);
				}

				// Set new timeout
				const timeout = setTimeout(async () => {
					try {
						console.log(
							`[Lifecycle] No heartbeat for ${INACTIVITY_TIMEOUT / 1000}s, stopping preview for project ${id}`,
						);
						await stopPreviewForProject(id);

						await Project.updateFields(id, {
							previewUrl: null,
							status: "draft",
						});

						activeProjects.delete(id);
						console.log(
							`[Lifecycle] Successfully stopped preview for project ${id}`,
						);

						// Reflect in status stream
						try {
							publishPreviewStatus(id, {
								status: "not-created",
								previewUrl: null,
							});
						} catch (e) {
							/* best-effort */
						}
					} catch (error) {
						console.error(
							`[Lifecycle] Failed to stop preview for project ${id}:`,
							error,
						);
						activeProjects.delete(id);
					}
				}, INACTIVITY_TIMEOUT);

				activeProjects.set(id, timeout);

				return { success: true, timeout: INACTIVITY_TIMEOUT };
			} catch (error) {
				console.error("Failed to handle heartbeat:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to handle heartbeat",
				});
			}
		},
	}),

	// POST /api/projects/[id]/deploy
	deployProject: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const project = await Project.getById(id);
				if (!project) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Project not found",
					});
				}

				const { containerId, url, deploymentId } =
					await createDeploymentContainer(id);
				const deployment = Deployment.create(id, containerId, url);

				await Project.updateFields(id, {
					deployedUrl: url,
					status: "deployed",
				});

				return {
					success: true,
					deployment: deployment
						? {
								id: deployment.id,
								containerId,
								url,
								deploymentId,
							}
						: null,
				};
			} catch (error) {
				console.error("Failed to deploy:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to deploy project",
				});
			}
		},
	}),

	// GET /api/projects/[id]/deploy
	getDeployments: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const deployments = Deployment.getByProjectId(id);
				return { deployments };
			} catch (error) {
				console.error("Failed to get deployments:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to get deployments",
				});
			}
		},
	}),

	// GET /api/projects/[id]/env
	getEnv: defineAction({
		input: z.object({
			id: z.string(),
		}),
		handler: async ({ id }) => {
			try {
				const envContent = await readProjectFile(id, ".env");

				if (!envContent) {
					return { env: {} };
				}

				const env = parseEnvFile(envContent);
				return { env };
			} catch (error) {
				console.error("Failed to read env file:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to read environment variables",
				});
			}
		},
	}),

	// POST /api/projects/[id]/env
	setEnv: defineAction({
		input: z.object({
			id: z.string(),
			env: z.record(z.string()),
		}),
		handler: async ({ id, env }) => {
			try {
				const envContent = stringifyEnvFile(env);
				await writeProjectFiles(id, [{ path: ".env", content: envContent }]);

				return { success: true };
			} catch (error) {
				console.error("Failed to write env file:", error);
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to save environment variables",
				});
			}
		},
	}),
};
