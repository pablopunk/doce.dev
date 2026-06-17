import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { requireUser } from "@/server/auth/requireUser";
import {
	addMcpServer,
	listMcpServers,
	removeMcpServer,
	toggleMcpServer,
} from "@/server/mcps/mcps.service";

export const mcps = {
	list: defineAction({
		handler: async (_input, context) => {
			requireUser(context);
			return listMcpServers();
		},
	}),

	add: defineAction({
		accept: "json",
		input: z.object({
			name: z.string().min(1),
			type: z.enum(["remote", "local"]),
			url: z.string().optional(),
			command: z.array(z.string()).optional(),
			enabled: z.boolean().default(true),
			environment: z.record(z.string(), z.string()).optional(),
			headers: z.record(z.string(), z.string()).optional(),
		}),
		handler: async (input, context) => {
			requireUser(context);
			const { name, ...config } = input;
			await addMcpServer(name, config);
			return { success: true };
		},
	}),

	remove: defineAction({
		accept: "json",
		input: z.object({ name: z.string().min(1) }),
		handler: async (input, context) => {
			requireUser(context);
			await removeMcpServer(input.name);
			return { success: true };
		},
	}),

	toggle: defineAction({
		accept: "json",
		input: z.object({
			name: z.string().min(1),
			enabled: z.boolean(),
		}),
		handler: async (input, context) => {
			requireUser(context);
			await toggleMcpServer(input.name, input.enabled);
			return { success: true };
		},
	}),
};
