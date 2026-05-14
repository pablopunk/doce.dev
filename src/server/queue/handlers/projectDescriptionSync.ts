import { Effect } from "effect";
import { ProjectError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { logger } from "@/server/logger";
import { createOpencodeClient } from "@/server/opencode/client";
import { getProjectByIdIncludeDeleted } from "@/server/projects/projects.model";
import { updateProjectDescriptionFromSessionTitle } from "@/server/projects/sessionDescription";
import { parsePayload } from "../types";

const RETRY_DELAY_MS = 2_000;
const SYNC_TIMEOUT_MS = 2 * 60_000;

function getSessionTitle(data: unknown): string | null {
	if (typeof data !== "object" || data === null) return null;
	const title = (data as { title?: unknown }).title;
	return typeof title === "string" ? title : null;
}

export function handleProjectDescriptionSync(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError> {
	return Effect.gen(function* () {
		const payload = parsePayload(
			"project.descriptionSync",
			ctx.job.payloadJson,
		);

		const project = yield* Effect.tryPromise({
			try: () => getProjectByIdIncludeDeleted(payload.projectId),
			catch: (error) =>
				new ProjectError({
					projectId: payload.projectId,
					operation: "getProjectByIdIncludeDeleted",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		if (!project || project.status === "deleting") return;
		const sessionId = project.bootstrapSessionId;
		if (!sessionId) return;

		const client = createOpencodeClient();
		const session = yield* Effect.tryPromise({
			try: () => client.session.get({ sessionID: sessionId }),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "getOpenCodeSession",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		const updated = yield* Effect.tryPromise({
			try: () =>
				updateProjectDescriptionFromSessionTitle(
					project.id,
					getSessionTitle(session.data),
				),
			catch: (error) =>
				new ProjectError({
					projectId: project.id,
					operation: "updateProjectDescriptionFromSessionTitle",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		if (updated) return;

		const elapsed = Date.now() - ctx.job.createdAt.getTime();
		if (elapsed >= SYNC_TIMEOUT_MS) {
			logger.debug(
				{
					projectId: project.id,
					sessionId,
					elapsed,
				},
				"Stopped waiting for OpenCode session title",
			);
			return;
		}

		ctx.reschedule(RETRY_DELAY_MS);
	});
}
