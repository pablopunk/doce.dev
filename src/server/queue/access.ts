import type { QueueJob } from "@/server/db/schema";
import { isProjectOwnedByUser } from "@/server/projects/projects.model";
import { parsePayload } from "./types";

export async function canUserAccessQueueJob(
	userId: string,
	job: QueueJob,
): Promise<boolean> {
	if (job.projectId) {
		return isProjectOwnedByUser(job.projectId, userId);
	}

	try {
		if (job.type === "projects.deleteAllForUser") {
			const payload = parsePayload(job.type, job.payloadJson);
			return payload.userId === userId;
		}

		if (job.type === "project.create") {
			const payload = parsePayload(job.type, job.payloadJson);
			return payload.ownerUserId === userId;
		}

		if (job.type === "project.delete") {
			const payload = parsePayload(job.type, job.payloadJson);
			return payload.requestedByUserId === userId;
		}
	} catch {
		return false;
	}

	return false;
}
