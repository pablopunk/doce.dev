import { Effect } from "effect";
import { ProjectError } from "@/server/effect/errors";
import type { QueueJobContext } from "@/server/effect/queue.worker";
import { getProjectsByUserId } from "@/server/projects/projects.model";
import { enqueueProjectDelete } from "../enqueue";
import { parsePayload } from "../types";

export function handleDeleteAllForUser(
	ctx: QueueJobContext,
): Effect.Effect<void, ProjectError> {
	return Effect.gen(function* () {
		const payload = parsePayload(
			"projects.deleteAllForUser",
			ctx.job.payloadJson,
		);

		const projects = yield* Effect.tryPromise({
			try: () => getProjectsByUserId(payload.userId),
			catch: (error) =>
				new ProjectError({
					operation: "getProjectsByUserId",
					message: error instanceof Error ? error.message : String(error),
					cause: error,
				}),
		});

		for (const project of projects) {
			yield* ctx.throwIfCancelRequested();

			yield* Effect.tryPromise({
				try: () =>
					enqueueProjectDelete({
						projectId: project.id,
						requestedByUserId: payload.userId,
					}),
				catch: (error) =>
					new ProjectError({
						projectId: project.id,
						operation: "enqueueProjectDelete",
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					}),
			});
		}
	});
}
