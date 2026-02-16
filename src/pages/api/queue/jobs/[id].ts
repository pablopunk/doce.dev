import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { canUserAccessQueueJob } from "@/server/queue/access";
import { getJobById } from "@/server/queue/queue.model";

const SESSION_COOKIE_NAME = "doce_session";

export const GET: APIRoute = async ({ params, cookies }) => {
	const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!sessionToken) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

	const session = await validateSession(sessionToken);
	if (!session) {
		return new Response(JSON.stringify({ error: "Unauthorized" }), {
			status: 401,
			headers: { "Content-Type": "application/json" },
		});
	}

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

	const canAccessJob = await canUserAccessQueueJob(session.user.id, job);
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
				state: job.state,
				attempts: job.attempts,
				maxAttempts: job.maxAttempts,
				projectId: job.projectId,
				runAt: job.runAt.toISOString(),
				createdAt: job.createdAt.toISOString(),
				updatedAt: job.updatedAt.toISOString(),
				lastError: job.lastError,
			},
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
