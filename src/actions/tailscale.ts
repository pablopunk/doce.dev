import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { asc } from "drizzle-orm";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import {
	getTailscaleConfig,
	getTailscaleStatus,
	isTailscaleInstalled,
	registerServe,
	setTailscaleConfig,
	tailscaleDown,
	tailscaleUp,
} from "@/server/tailscale";
import { invalidateTailscaleUrlCache } from "@/server/tailscale/urls";

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

			return { installed: true, config, status };
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

			await tailscaleUp(input.authKey, input.hostname);

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
				await registerServe(4321, 443);
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
