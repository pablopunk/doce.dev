import { ActionError, defineAction } from "astro:actions";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { z } from "astro/zod";
import { getProjectPreviewPath } from "@/server/projects/paths";
import { isProjectOwnedByUser } from "@/server/projects/projects.model";
import {
	buildAssetsList,
	getFileExtension,
	isAllowedExtension,
	sanitizeFilename,
} from "./assetHelpers";

export const assets = {
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

			const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
			if (!isOwner) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			try {
				const projectPath = getProjectPreviewPath(input.projectId);
				const publicPath = path.join(projectPath, "public");

				try {
					await fs.access(publicPath);
				} catch {
					return { assets: [] };
				}

				const assets = await buildAssetsList(publicPath);
				return { assets };
			} catch (_error) {
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

			const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
			if (!isOwner) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			try {
				const projectPath = getProjectPreviewPath(input.projectId);
				const publicPath = path.join(projectPath, "public");

				await fs.mkdir(publicPath, { recursive: true });

				const uploadedAssets: Array<{
					name: string;
					path: string;
					size: number;
					mimeType: string;
					isImage: boolean;
				}> = [];
				const errors: string[] = [];

				for (const file of input.files) {
					const filename = sanitizeFilename(file.name);
					const ext = getFileExtension(filename);

					if (!isAllowedExtension(ext)) {
						errors.push(`${file.name}: File type not allowed`);
						continue;
					}

					if (file.size > 50 * 1024 * 1024) {
						errors.push(`${file.name}: File too large (max 50MB)`);
						continue;
					}

					const filePath = path.join(publicPath, filename);
					try {
						await fs.access(filePath);
						errors.push(`${file.name}: File already exists`);
						continue;
					} catch {
						// File doesn't exist, proceed
					}

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
			} catch (_error) {
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

			const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
			if (!isOwner) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			try {
				const sanitizedNewName = sanitizeFilename(input.newName);

				const oldExt = getFileExtension(input.oldName);
				const newExt = getFileExtension(sanitizedNewName);

				if (oldExt.toLowerCase() !== newExt.toLowerCase()) {
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "File extension cannot be changed",
					});
				}

				const projectPath = getProjectPreviewPath(input.projectId);
				const publicPath = path.join(projectPath, "public");
				const oldPath = path.join(publicPath, input.oldName);
				const newPath = path.join(publicPath, sanitizedNewName);

				if (
					!oldPath.startsWith(publicPath) ||
					!newPath.startsWith(publicPath)
				) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "Invalid file path",
					});
				}

				try {
					await fs.access(oldPath);
				} catch {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "File not found",
					});
				}

				try {
					await fs.access(newPath);
					// File exists, throw error
					throw new ActionError({
						code: "BAD_REQUEST",
						message: "File with this name already exists",
					});
				} catch (err) {
					// If it's our ActionError, rethrow it; otherwise file doesn't exist so continue
					if (
						err &&
						typeof err === "object" &&
						"code" in err &&
						"message" in err
					) {
						// This is an ActionError we threw
						throw err;
					}
					// fs.access threw because file doesn't exist - that's ok, continue
				}

				await fs.rename(oldPath, newPath);

				return { success: true };
			} catch (error) {
				// Re-throw ActionError as-is, wrap unexpected errors
				if (error && typeof error === "object" && "code" in error) {
					throw error;
				}
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

			const isOwner = await isProjectOwnedByUser(input.projectId, user.id);
			if (!isOwner) {
				throw new ActionError({
					code: "FORBIDDEN",
					message: "You don't have access to this project",
				});
			}

			try {
				const projectPath = getProjectPreviewPath(input.projectId);
				const publicPath = path.join(projectPath, "public");
				const filePath = path.join(publicPath, input.path);

				const resolvedPath = path.resolve(filePath);
				const resolvedPublicPath = path.resolve(publicPath) + path.sep;

				if (!resolvedPath.startsWith(resolvedPublicPath)) {
					throw new ActionError({
						code: "FORBIDDEN",
						message: "Invalid file path",
					});
				}

				try {
					await fs.access(filePath);
				} catch {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "File not found",
					});
				}

				await fs.unlink(filePath);

				return { success: true };
			} catch (error) {
				// Re-throw ActionError as-is, wrap unexpected errors
				if (error && typeof error === "object" && "code" in error) {
					throw error;
				}
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to delete asset",
				});
			}
		},
	}),
};
