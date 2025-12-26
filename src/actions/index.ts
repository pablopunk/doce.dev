import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { randomBytes } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, invalidateSession } from "@/server/auth/sessions";
import { db } from "@/server/db/client";
import { userSettings, users } from "@/server/db/schema";
import {
	getProjectById,
	getProjectsByUserId,
	isProjectOwnedByUser,
	updateOpencodeJsonModel,
	updateProjectModel,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import {
	enqueueDeleteAllProjectsForUser,
	enqueueDockerStop,
	enqueueProjectCreate,
	enqueueProjectDelete,
} from "@/server/queue/enqueue";
import {
	cancelQueuedJob,
	deleteJob,
	deleteJobsByState,
	forceUnlock,
	getJobById,
	requestCancel,
	retryJob,
	runNow,
	setConcurrency,
	setQueuePaused,
} from "@/server/queue/queue.model";
import {
	AVAILABLE_MODELS,
	DEFAULT_MODEL,
	validateOpenRouterApiKey,
} from "@/server/settings/openrouter";

const SESSION_COOKIE_NAME = "doce_session";

// Helper functions for assets
const ALLOWED_EXTENSIONS = new Set([
	// Images
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"svg",
	// Media
	"mp4",
	"webm",
	"mp3",
	"wav",
	// Documents
	"pdf",
	"json",
	"txt",
	"md",
	"csv",
]);

/**
 * Sanitize filename: keep only alphanumeric, hyphens, underscores, dots
 */
function sanitizeFilename(filename: string): string {
	return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
	const parts = filename.split(".");
	if (parts.length < 2) return "";
	const ext = parts[parts.length - 1];
	return (ext ?? "").toLowerCase();
}

/**
 * Check if file extension is allowed
 */
function isAllowedExtension(extension: string): boolean {
	return ALLOWED_EXTENSIONS.has(extension.toLowerCase());
}

/**
 * Build assets list from public directory
 */
async function buildAssetsList(publicPath: string): Promise<
	Array<{
		name: string;
		path: string;
		size: number;
		mimeType: string;
		isImage: boolean;
	}>
> {
	try {
		const entries = await fs.readdir(publicPath, { withFileTypes: true });
		const assets = [];

		for (const entry of entries) {
			// Skip hidden files and directories
			if (entry.name.startsWith(".")) {
				continue;
			}

			// Only include files, skip directories
			if (!entry.isFile()) {
				continue;
			}

			const fullPath = path.join(publicPath, entry.name);
			const stats = await fs.stat(fullPath);
			const ext = getFileExtension(entry.name);

			// Only include files with allowed extensions
			if (!isAllowedExtension(ext)) {
				continue;
			}

			const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
				ext.toLowerCase(),
			);

			assets.push({
				name: entry.name,
				path: entry.name,
				size: stats.size,
				mimeType: `application/${ext}`,
				isImage,
			});
		}

		// Sort alphabetically
		assets.sort((a, b) => a.name.localeCompare(b.name));
		return assets;
	} catch {
		return [];
	}
}

export const server = {
	setup: {
		createAdmin: defineAction({
			accept: "form",
			input: z.object({
				username: z.string().min(1, "Username is required"),
				password: z.string().min(1, "Password is required"),
				confirmPassword: z.string(),
				openrouterApiKey: z.string().min(1, "OpenRouter API key is required"),
				defaultModel: z.string().default(DEFAULT_MODEL),
			}),
			handler: async (input, context) => {
				// Check if admin already exists
				const existingUsers = await db.select().from(users).limit(1);
				if (existingUsers.length > 0) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "Admin user already exists",
					});
				}

				// Validate passwords match
				if (input.password !== input.confirmPassword) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Passwords do not match",
					});
				}

				// Validate OpenRouter API key
				const validation = await validateOpenRouterApiKey(
					input.openrouterApiKey,
				);
				if (!validation.valid) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: validation.error ?? "Invalid OpenRouter API key",
					});
				}

				// Create admin user
				const userId = randomBytes(16).toString("hex");
				const passwordHash = await hashPassword(input.password);
				const now = new Date();

				await db.insert(users).values({
					id: userId,
					username: input.username,
					createdAt: now,
					passwordHash,
				});

				// Create user settings
				await db.insert(userSettings).values({
					userId,
					openrouterApiKey: input.openrouterApiKey,
					defaultModel: input.defaultModel,
					updatedAt: now,
				});

				// Create session and set cookie
				const sessionToken = await createSession(userId);
				context.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
					path: "/",
					httpOnly: true,
					sameSite: "lax",
					secure: import.meta.env.PROD,
					maxAge: 60 * 60 * 24 * 30, // 30 days
				});

				return { success: true };
			},
		}),
	},

	auth: {
		login: defineAction({
			accept: "form",
			input: z.object({
				username: z.string().min(1, "Username is required"),
				password: z.string().min(1, "Password is required"),
			}),
			handler: async (input, context) => {
				// Get the user by username
				const foundUsers = await db
					.select()
					.from(users)
					.where(eq(users.username, input.username))
					.limit(1);
				const user = foundUsers[0];

				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "Invalid username or password",
					});
				}

				// Verify password
				const isValid = await verifyPassword(input.password, user.passwordHash);
				if (!isValid) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "Invalid username or password",
					});
				}

				// Create session and set cookie
				const sessionToken = await createSession(user.id);
				context.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
					path: "/",
					httpOnly: true,
					sameSite: "lax",
					secure: import.meta.env.PROD,
					maxAge: 60 * 60 * 24 * 30, // 30 days
				});

				return { success: true };
			},
		}),

		logout: defineAction({
			handler: async (_input, context) => {
				const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
				if (sessionToken) {
					await invalidateSession(sessionToken);
					context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
				}
				return { success: true };
			},
		}),
	},

	settings: {
		save: defineAction({
			accept: "form",
			input: z.object({
				openrouterApiKey: z.string().min(1, "OpenRouter API key is required"),
				defaultModel: z.string().default(DEFAULT_MODEL),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to save settings",
					});
				}

				// Validate OpenRouter API key
				const validation = await validateOpenRouterApiKey(
					input.openrouterApiKey,
				);
				if (!validation.valid) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: validation.error ?? "Invalid OpenRouter API key",
					});
				}

				// Update user settings
				await db
					.update(userSettings)
					.set({
						openrouterApiKey: input.openrouterApiKey,
						defaultModel: input.defaultModel,
						updatedAt: new Date(),
					})
					.where(eq(userSettings.userId, user.id));

				return { success: true };
			},
		}),

		get: defineAction({
			handler: async (_input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to get settings",
					});
				}

				const settings = await db
					.select()
					.from(userSettings)
					.where(eq(userSettings.userId, user.id))
					.limit(1);

				return {
					settings: settings[0] ?? null,
					availableModels: AVAILABLE_MODELS,
				};
			},
		}),
	},

	projects: {
		create: defineAction({
			accept: "form",
			input: z.object({
				prompt: z.string().min(1, "Please describe your website"),
				model: z.string().optional(),
				images: z.string().optional(), // JSON string of image attachments
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to create a project",
					});
				}

				// Get user settings to verify API key exists
				const settings = await db
					.select()
					.from(userSettings)
					.where(eq(userSettings.userId, user.id))
					.limit(1);

				const userSettingsData = settings[0];
				if (!userSettingsData?.openrouterApiKey) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Please configure your OpenRouter API key in settings",
					});
				}

				// Parse images from JSON string if provided
				let images:
					| Array<{ filename: string; mime: string; dataUrl: string }>
					| undefined;
				if (input.images) {
					try {
						images = JSON.parse(input.images);
					} catch {
						// Ignore invalid JSON, proceed without images
					}
				}

				// Generate project ID upfront so we can return it immediately
				const projectId = randomBytes(12).toString("hex");

				// Enqueue the project creation job asynchronously
				// Don't await - return immediately to the user
				enqueueProjectCreate({
					projectId,
					ownerUserId: user.id,
					prompt: input.prompt,
					model: input.model ?? userSettingsData.defaultModel ?? null,
					images,
				}).catch((err) => {
					console.error("Failed to enqueue project creation:", err);
				});

				return {
					success: true,
					projectId,
				};
			},
		}),

		list: defineAction({
			handler: async (_input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to list projects",
					});
				}

				const projects = await getProjectsByUserId(user.id);
				return { projects };
			},
		}),

		get: defineAction({
			input: z.object({
				projectId: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to view a project",
					});
				}

				const project = await getProjectById(input.projectId);
				if (!project) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Project not found",
					});
				}

				if (project.ownerUserId !== user.id) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "You don't have access to this project",
					});
				}

				return { project };
			},
		}),

		delete: defineAction({
			input: z.object({
				projectId: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to delete a project",
					});
				}

				// Verify ownership
				const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
				if (!isOwner) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "You don't have access to this project",
					});
				}

				try {
					await updateProjectStatus(input.projectId, "deleting");
				} catch {
					// ignore
				}

				const job = await enqueueProjectDelete({
					projectId: input.projectId,
					requestedByUserId: user.id,
				});

				return { success: true, jobId: job.id };
			},
		}),

		stop: defineAction({
			input: z.object({
				projectId: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to stop a project",
					});
				}

				const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
				if (!isOwner) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "You don't have access to this project",
					});
				}

				const job = await enqueueDockerStop({
					projectId: input.projectId,
					reason: "user",
				});

				return { success: true, jobId: job.id };
			},
		}),

		updateModel: defineAction({
			input: z.object({
				projectId: z.string(),
				model: z.string().nullable(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to update a project",
					});
				}

				const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
				if (!isOwner) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "You don't have access to this project",
					});
				}

				// Update database
				await updateProjectModel(input.projectId, input.model);

				// Also update opencode.json on disk for file-based persistence
				if (input.model) {
					try {
						await updateOpencodeJsonModel(input.projectId, input.model);
					} catch (error) {
						// Log warning but don't fail - DB is already updated
						console.warn(
							"Updated model in database but failed to update opencode.json. Next OpenCode session may not reflect model change until file is manually synced.",
						);
					}
				}

				return { success: true };
			},
		}),

		deleteAll: defineAction({
			handler: async (_input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to delete projects",
					});
				}

				const job = await enqueueDeleteAllProjectsForUser({ userId: user.id });

				return { success: true, jobId: job.id };
			},
		}),
	},

	queue: {
		stopAll: defineAction({
			handler: async (_input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				// Get all projects for the user
				const userProjects = await getProjectsByUserId(user.id);

				// Enqueue docker.stop for each project
				const jobs = [];
				for (const project of userProjects) {
					const job = await enqueueDockerStop({
						projectId: project.id,
						reason: "user",
					});
					jobs.push(job);
				}

				return { success: true, jobsEnqueued: jobs.length };
			},
		}),

		cancel: defineAction({
			input: z.object({
				jobId: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				const job = await getJobById(input.jobId);
				if (!job) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Job not found",
					});
				}

				if (job.state === "queued") {
					await cancelQueuedJob(job.id);
					return { success: true, state: "cancelled" };
				}

				await requestCancel(job.id);
				return { success: true, state: "cancelling" };
			},
		}),

		retry: defineAction({
			input: z.object({
				jobId: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				const newJobId = randomBytes(16).toString("hex");
				const newJob = await retryJob(input.jobId, newJobId);
				return { success: true, jobId: newJob.id };
			},
		}),

		runNow: defineAction({
			input: z.object({
				jobId: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				const updated = await runNow(input.jobId);
				if (!updated) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "Job is not queued",
					});
				}

				return { success: true };
			},
		}),

		pause: defineAction({
			handler: async (_input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				await setQueuePaused(true);
				return { success: true };
			},
		}),

		resume: defineAction({
			handler: async (_input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				await setQueuePaused(false);
				return { success: true };
			},
		}),

		forceUnlock: defineAction({
			input: z.object({
				jobId: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				const updated = await forceUnlock(input.jobId);
				if (!updated) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Job not found",
					});
				}

				return { success: true };
			},
		}),

		deleteJob: defineAction({
			input: z.object({
				jobId: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				const deleted = await deleteJob(input.jobId);
				if (deleted === 0) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message:
							"Job not found or not in terminal state (can only delete succeeded, failed, or cancelled jobs)",
					});
				}

				return { success: true };
			},
		}),

		deleteByState: defineAction({
			input: z.object({
				state: z.enum(["succeeded", "failed", "cancelled"]),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				const deleted = await deleteJobsByState(input.state);
				return { success: true, deleted };
			},
		}),

		setConcurrency: defineAction({
			input: z.object({
				concurrency: z.number().int().min(1).max(20),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to manage the queue",
					});
				}

				await setConcurrency(input.concurrency);
				return { success: true };
			},
		}),
	},

	assets: {
		list: defineAction({
			input: z.object({
				projectId: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to list assets",
					});
				}

				// Verify project ownership
				const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
				if (!isOwner) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "You don't have access to this project",
					});
				}

				try {
					const projectPath = path.join(
						process.cwd(),
						"data",
						"projects",
						input.projectId,
					);
					const publicPath = path.join(projectPath, "public");

					// Check if public directory exists
					try {
						await fs.access(publicPath);
					} catch {
						// Directory doesn't exist, return empty list
						return { assets: [] };
					}

					const assets = await buildAssetsList(publicPath);
					return { assets };
				} catch (error) {
					throw new ActionError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to list assets",
					});
				}
			},
		}),

		upload: defineAction({
			accept: "form",
			input: z.object({
				projectId: z.string().min(1),
				files: z.array(z.instanceof(File)),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to upload assets",
					});
				}

				// Verify project ownership
				const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
				if (!isOwner) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "You don't have access to this project",
					});
				}

				try {
					const projectPath = path.join(
						process.cwd(),
						"data",
						"projects",
						input.projectId,
					);
					const publicPath = path.join(projectPath, "public");

					// Create public directory if it doesn't exist
					await fs.mkdir(publicPath, { recursive: true });

					const uploadedAssets: Array<{
						name: string;
						path: string;
						size: number;
						mimeType: string;
						isImage: boolean;
					}> = [];
					const errors: string[] = [];

					// Process each file from the input array
					for (const file of input.files) {
						const filename = sanitizeFilename(file.name);
						const ext = getFileExtension(filename);

						// Validate extension
						if (!isAllowedExtension(ext)) {
							errors.push(`${file.name}: File type not allowed`);
							continue;
						}

						// Validate file size (50MB max)
						if (file.size > 50 * 1024 * 1024) {
							errors.push(`${file.name}: File too large (max 50MB)`);
							continue;
						}

						// Check if file already exists
						const filePath = path.join(publicPath, filename);
						try {
							await fs.access(filePath);
							errors.push(`${file.name}: File already exists`);
							continue;
						} catch {
							// File doesn't exist, proceed
						}

						// Write file
						const buffer = await file.arrayBuffer();
						await fs.writeFile(filePath, Buffer.from(buffer));

						uploadedAssets.push({
							name: filename,
							path: filename,
							size: file.size,
							mimeType: file.type,
							isImage: file.type.startsWith("image/"),
						});
					}

					return {
						success: true,
						assets: uploadedAssets,
						errors: errors.length > 0 ? errors : undefined,
					};
				} catch (error) {
					throw new ActionError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to upload assets",
					});
				}
			},
		}),

		rename: defineAction({
			input: z.object({
				projectId: z.string(),
				oldName: z.string(),
				newName: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to rename assets",
					});
				}

				// Verify project ownership
				const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
				if (!isOwner) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "You don't have access to this project",
					});
				}

				try {
					const sanitizedNewName = sanitizeFilename(input.newName);

					// Validate new name extension matches old name
					const oldExt = getFileExtension(input.oldName);
					const newExt = getFileExtension(sanitizedNewName);

					if (oldExt.toLowerCase() !== newExt.toLowerCase()) {
						throw new ActionError({
							code: "BAD_REQUEST",
							message: "File extension cannot be changed",
						});
					}

					const projectPath = path.join(
						process.cwd(),
						"data",
						"projects",
						input.projectId,
					);
					const publicPath = path.join(projectPath, "public");
					const oldPath = path.join(publicPath, input.oldName);
					const newPath = path.join(publicPath, sanitizedNewName);

					// Prevent path traversal
					if (
						!oldPath.startsWith(publicPath) ||
						!newPath.startsWith(publicPath)
					) {
						throw new ActionError({
							code: "FORBIDDEN",
							message: "Invalid file path",
						});
					}

					// Check if old file exists
					try {
						await fs.access(oldPath);
					} catch {
						throw new ActionError({
							code: "NOT_FOUND",
							message: "File not found",
						});
					}

					// Check if new name already exists
					try {
						await fs.access(newPath);
						throw new ActionError({
							code: "BAD_REQUEST",
							message: "File with this name already exists",
						});
					} catch (err) {
						if (err instanceof ActionError) throw err;
						// File doesn't exist, proceed
					}

					// Rename file
					await fs.rename(oldPath, newPath);

					return { success: true };
				} catch (error) {
					if (error instanceof ActionError) throw error;
					throw new ActionError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to rename asset",
					});
				}
			},
		}),

		delete: defineAction({
			input: z.object({
				projectId: z.string(),
				path: z.string(),
			}),
			handler: async (input, context) => {
				const user = context.locals.user;
				if (!user) {
					throw new ActionError({
						code: "UNAUTHORIZED",
						message: "You must be logged in to delete assets",
					});
				}

				// Verify project ownership
				const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
				if (!isOwner) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "You don't have access to this project",
					});
				}

				try {
					const projectPath = path.join(
						process.cwd(),
						"data",
						"projects",
						input.projectId,
					);
					const publicPath = path.join(projectPath, "public");
					const filePath = path.join(publicPath, input.path);

					// Prevent path traversal
					const resolvedPath = path.resolve(filePath);
					const resolvedPublicPath = path.resolve(publicPath) + path.sep;

					if (!resolvedPath.startsWith(resolvedPublicPath)) {
						throw new ActionError({
							code: "FORBIDDEN",
							message: "Invalid file path",
						});
					}

					// Check if file exists
					try {
						await fs.access(filePath);
					} catch {
						throw new ActionError({
							code: "NOT_FOUND",
							message: "File not found",
						});
					}

					// Delete file
					await fs.unlink(filePath);

					return { success: true };
				} catch (error) {
					if (error instanceof ActionError) throw error;
					throw new ActionError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to delete asset",
					});
				}
			},
		}),
	},
};
