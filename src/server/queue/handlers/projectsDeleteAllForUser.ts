import { getProjectsByUserId } from "@/server/projects/projects.model";
import type { QueueJobContext } from "../queue.worker";
import { parsePayload } from "../types";
import { enqueueProjectDelete } from "../enqueue";

export async function handleDeleteAllForUser(ctx: QueueJobContext): Promise<void> {
  const payload = parsePayload("projects.deleteAllForUser", ctx.job.payloadJson);

  const projects = await getProjectsByUserId(payload.userId);

  for (const project of projects) {
    await ctx.throwIfCancelRequested();

    await enqueueProjectDelete({
      projectId: project.id,
      requestedByUserId: payload.userId,
    });
  }
}
