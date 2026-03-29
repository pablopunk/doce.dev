import type { APIRoute } from "astro";
import { requireAuth } from "@/server/auth/requireAuth";
import { canUserAccessQueueJob } from "@/server/queue/access";
import {
	getQueueJobDerivedError,
	getQueueJobDerivedState,
} from "@/server/queue/job-state";
import { getJobById } from "@/server/queue/queue.model";

export const GET: APIRoute = async ({ params, cookies }) => {
	const auth = await requireAuth(cookies);
	if (!auth.ok) return auth.response;

	const jobId = params.id;
	if (!jobId) {
		return new Response(JSON.stringify({ error: "Job ID required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const job = await getJobById(jobId);
	if (!job) {
		return new Response(JSON.stringify({ error: "Not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	const canAccessJob = await canUserAccessQueueJob(auth.user.id, job);
	if (!canAccessJob) {
		return new Response(JSON.stringify({ error: "Not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(
		JSON.stringify({
			job: {
				id: job.id,
				type: job.type,
				state: getQueueJobDerivedState(job),
				attempts: job.attempts,
				maxAttempts: job.maxAttempts,
				projectId: job.projectId,
				runAt: job.runAt.toISOString(),
				createdAt: job.createdAt.toISOString(),
				updatedAt: job.updatedAt.toISOString(),
				lastError: getQueueJobDerivedError(job),
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
