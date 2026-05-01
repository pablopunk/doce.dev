import type { LegacyHandler } from "@/server/effect/handler-adapter";
import { generateProjectIdentity } from "@/server/llm/autoname";
import { logger } from "@/server/logger";
import { updateProjectIdentity } from "@/server/projects/projects.model";
import { parsePayload } from "../types";

export const handleProjectIdentityGenerate: LegacyHandler = async (ctx) => {
	const payload = parsePayload("project.identityGenerate", ctx.job.payloadJson);
	const { projectId, prompt, model } = payload;

	await ctx.throwIfCancelRequested();

	const identity = await generateProjectIdentity(prompt, model);
	await updateProjectIdentity(projectId, {
		name: identity.name,
		icon: identity.icon,
		slug: identity.name,
	});

	logger.info(
		{ projectId, name: identity.name, icon: identity.icon },
		"Generated project identity",
	);
};
