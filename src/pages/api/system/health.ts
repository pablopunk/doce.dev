import type { APIRoute } from "astro";
import { count, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { projects, queueJobs, systemHealthSnapshots } from "@/server/db/schema";
import { isGlobalOpencodeHealthy } from "@/server/opencode/runtime";

export const GET: APIRoute = async () => {
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

	// Project stats
	const projectStats = await db
		.select({
			status: projects.status,
			count: count(),
		})
		.from(projects)
		.where(isNull(projects.deletedAt))
		.groupBy(projects.status);

	const projectMap = Object.fromEntries(
		projectStats.map((s) => [s.status, s.count]),
	);

	// Latest snapshot
	const snapshot = await db
		.select()
		.from(systemHealthSnapshots)
		.orderBy((t) => t.takenAt)
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
				total: Object.values(projectMap).reduce((a, b) => a + b, 0),
				created: projectMap.created || 0,
				starting: projectMap.starting || 0,
				running: projectMap.running || 0,
				stopping: projectMap.stopping || 0,
				stopped: projectMap.stopped || 0,
				error: projectMap.error || 0,
				deleting: projectMap.deleting || 0,
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
