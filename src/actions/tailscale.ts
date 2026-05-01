import { ActionError, defineAction } from "astro:actions";
import { userInfo } from "node:os";
import { z } from "astro/zod";
import { asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { composeDown } from "@/server/docker/compose";
import { getProjectPreviewPath } from "@/server/projects/paths";
import {
	getProjectsByUserId,
	updateProjectStatus,
} from "@/server/projects/projects.model";
import { enqueueDockerEnsureRunning } from "@/server/queue/enqueue";
import {
	getServeStatus,
	getTailscaleConfig,
	getTailscaleStatus,
	isTailscaleInstalled,
	registerServe,
	setTailscaleConfig,
	tailscaleDown,
	tailscaleUp,
} from "@/server/tailscale";
import { invalidateTailscaleUrlCache } from "@/server/tailscale/urls";
import { runCommand } from "@/server/utils/execAsync";

async function ensureAdmin(userId: string): Promise<void> {
	const firstUser = await db
		.select({ id: users.id })
		.from(users)
		.orderBy(asc(users.createdAt))
		.limit(1);

	if (firstUser[0]?.id !== userId) {
		throw new ActionError({
			code: "FORBIDDEN",
			message: "Only admin can manage Tailscale settings",
		});
	}
}

function ensureAuth(
	user: { id: string } | null,
): asserts user is { id: string } {
	if (!user) {
		throw new ActionError({
			code: "UNAUTHORIZED",
			message: "You must be logged in",
		});
	}
}

function shellArg(value: string): string {
	return `'${value.replaceAll("'", "'\\''")}'`;
}

function getOperatorCommand(username: string): string {
	return `sudo tailscale set --operator=${username}`;
}

function getCurrentUsername(): string {
	try {
		return userInfo().username;
	} catch {
		throw new ActionError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Could not detect the local Linux username",
		});
	}
}

function needsOperatorPermission(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return (
		message.includes("set --operator") || message.includes("Access denied")
	);
}

async function grantLocalOperatorPermission(): Promise<void> {
	const username = getCurrentUsername();
	const result = await runCommand(
		`pkexec tailscale set --operator=${shellArg(username)}`,
		{ timeout: 120000 },
	);

	if (!result.success) {
		throw new ActionError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Could not grant Tailscale permissions. Run manually: ${getOperatorCommand(username)}. ${result.stderr}`,
		});
	}
}

async function runWithOperatorPrompt(
	operation: () => Promise<void>,
): Promise<void> {
	try {
		await operation();
	} catch (error) {
		if (!needsOperatorPermission(error)) {
			throw error;
		}

		await grantLocalOperatorPermission();
		await operation();
	}
}

function hasServeConfig(serveStatus: unknown): boolean {
	if (!serveStatus || typeof serveStatus !== "object") {
		return false;
	}

	return Object.keys(serveStatus).length > 0;
}

async function projectHasPreviewTailscaleSidecar(
	projectId: string,
): Promise<boolean> {
	const projectName = `doce_${projectId}`;
	const result = await runCommand(
		`docker ps --filter label=com.docker.compose.project=${shellArg(projectName)} --filter label=com.docker.compose.service=tailscale --format '{{.ID}}'`,
		{ timeout: 5000 },
	);

	return result.success && result.stdout.trim().length > 0;
}

async function getPreviewProjectsNeedingTailscale(userId: string) {
	const config = await getTailscaleConfig();
	if (!config.enabled) {
		return [];
	}

	const projects = await getProjectsByUserId(userId);
	const runningProjects = projects.filter(
		(project) => project.status === "running",
	);
	const checks = await Promise.all(
		runningProjects.map(async (project) => ({
			project,
			hasTailscale: await projectHasPreviewTailscaleSidecar(project.id),
		})),
	);

	return checks
		.filter((check) => !check.hasTailscale)
		.map((check) => check.project);
}

export const tailscale = {
	getStatus: defineAction({
		handler: async (_input, context) => {
			ensureAuth(context.locals.user);

			const installed = await isTailscaleInstalled();
			if (!installed) {
				return { installed: false, config: null, status: null };
			}

			const config = await getTailscaleConfig();
			const status = config.enabled ? await getTailscaleStatus() : null;
			let serveWarning: string | null = null;

			if (config.enabled && status?.connected) {
				try {
					const serveStatus = await getServeStatus();
					if (!hasServeConfig(serveStatus)) {
						await registerServe(4321, 443);
					}
				} catch (error) {
					serveWarning = error instanceof Error ? error.message : String(error);
				}
			}

			return { installed: true, config, status, serveWarning };
		},
	}),

	connect: defineAction({
		accept: "json",
		input: z.object({
			authKey: z.string().min(1, "Auth key is required"),
			hostname: z.string().min(1).default("doce"),
		}),
		handler: async (input, context) => {
			ensureAuth(context.locals.user);
			await ensureAdmin(context.locals.user.id);

			const installed = await isTailscaleInstalled();
			if (!installed) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message:
						"Tailscale is not installed. Deploy doce with the latest Docker image to enable Tailscale.",
				});
			}

			await runWithOperatorPrompt(() =>
				tailscaleUp(input.authKey, input.hostname),
			);

			// Get the status to discover tailnet name
			const status = await getTailscaleStatus();

			await setTailscaleConfig({
				enabled: true,
				authKey: input.authKey,
				hostname: input.hostname,
				tailnetName: status.tailnetName,
			});

			// Register the main app on HTTPS 443
			try {
				await runWithOperatorPrompt(() => registerServe(4321, 443));
			} catch (error) {
				// Non-fatal: serve may not work in all environments
				const message =
					error instanceof Error ? error.message : "Unknown error";
				return {
					success: true,
					status,
					serveWarning: `Connected but Tailscale Serve failed: ${message}`,
				};
			}

			invalidateTailscaleUrlCache();
			return { success: true, status, serveWarning: null };
		},
	}),

	getReconcileStatus: defineAction({
		handler: async (_input, context) => {
			ensureAuth(context.locals.user);
			const projectsNeedingPreviewRestart =
				await getPreviewProjectsNeedingTailscale(context.locals.user.id);

			return {
				previewRestartCount: projectsNeedingPreviewRestart.length,
				previews: projectsNeedingPreviewRestart.map((project) => ({
					id: project.id,
					name: project.name,
					slug: project.slug,
				})),
			};
		},
	}),

	reconcilePreviews: defineAction({
		handler: async (_input, context) => {
			ensureAuth(context.locals.user);
			await ensureAdmin(context.locals.user.id);

			const projectsNeedingPreviewRestart =
				await getPreviewProjectsNeedingTailscale(context.locals.user.id);

			for (const project of projectsNeedingPreviewRestart) {
				await composeDown(project.id, getProjectPreviewPath(project.id));
				await updateProjectStatus(project.id, "starting");
				await enqueueDockerEnsureRunning({
					projectId: project.id,
					reason: "user",
				});
			}

			return {
				success: true,
				restartedCount: projectsNeedingPreviewRestart.length,
			};
		},
	}),

	enableLocalOperator: defineAction({
		handler: async (_input, context) => {
			ensureAuth(context.locals.user);
			await ensureAdmin(context.locals.user.id);

			await grantLocalOperatorPermission();
			await registerServe(4321, 443);
			return { success: true };
		},
	}),

	disconnect: defineAction({
		handler: async (_input, context) => {
			ensureAuth(context.locals.user);
			await ensureAdmin(context.locals.user.id);

			await tailscaleDown();

			invalidateTailscaleUrlCache();
			await setTailscaleConfig({
				enabled: false,
				authKey: null,
				hostname: null,
				tailnetName: null,
			});

			return { success: true };
		},
	}),
};
