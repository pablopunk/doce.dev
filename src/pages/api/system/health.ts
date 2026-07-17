import type { APIRoute } from "astro";
import { count, desc, isNull } from "drizzle-orm";
import { requireAuth } from "@/server/auth/requireAuth";
import { db } from "@/server/db/client";
import { projects, queueJobs, systemHealthSnapshots } from "@/server/db/schema";
import { isGlobalOpencodeHealthy } from "@/server/opencode/runtime";

export const GET: APIRoute = async ({ cookies }) => {
	const auth = await requireAuth(cookies);
	if (!auth.ok) return auth.response;

	// Queue stats
	const queueStats = await db
		.select({
			state: queueJobs.state,
			count: count(),
		})
		.from(queueJobs)
		.groupBy(queueJobs.state);

	const queueMap = Object.fromEntries(
		queueStats.map((s) => [s.state, s.count]),
	);

	// Project stats expose intent and runtime health separately. A project can be
	// desired=running while observed=unhealthy, which is the useful signal here.
	const desiredProjectStats = await db
		.select({
			status: projects.desiredStatus,
			count: count(),
		})
		.from(projects)
		.where(isNull(projects.deletedAt))
		.groupBy(projects.desiredStatus);
	const observedProjectStats = await db
		.select({
			status: projects.observedStatus,
			count: count(),
		})
		.from(projects)
		.where(isNull(projects.deletedAt))
		.groupBy(projects.observedStatus);

	const desiredProjectMap = Object.fromEntries(
		desiredProjectStats.map((s) => [s.status, s.count]),
	);
	const observedProjectMap = Object.fromEntries(
		observedProjectStats.map((s) => [s.status, s.count]),
	);

	// Latest snapshot
	const snapshot = await db
		.select()
		.from(systemHealthSnapshots)
		.orderBy(desc(systemHealthSnapshots.takenAt))
		.limit(1);

	// OpenCode health
	const opencodeHealthy = await isGlobalOpencodeHealthy().catch(() => false);

	return new Response(
		JSON.stringify({
			queue: {
				queued: queueMap.queued || 0,
				running: queueMap.running || 0,
				succeeded: queueMap.succeeded || 0,
				failed: queueMap.failed || 0,
				cancelled: queueMap.cancelled || 0,
			},
			projects: {
				total: Object.values(desiredProjectMap).reduce((a, b) => a + b, 0),
				desired: {
					created: desiredProjectMap.created || 0,
					running: desiredProjectMap.running || 0,
					stopped: desiredProjectMap.stopped || 0,
					deleting: desiredProjectMap.deleting || 0,
				},
				observed: {
					unknown: observedProjectMap.unknown || 0,
					healthy: observedProjectMap.healthy || 0,
					unhealthy: observedProjectMap.unhealthy || 0,
					missing: observedProjectMap.missing || 0,
					crashed: observedProjectMap.crashed || 0,
				},
			},
			infrastructure: {
				opencodeHealthy,
				dockerNetworkExists: true,
				dockerVolumeExists: true,
			},
			lastSnapshot: snapshot[0] ?? null,
		}),
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	);
};
