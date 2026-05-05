import type { APIRoute } from "astro";
import type { QueueJob } from "@/server/db/schema";
import { logger } from "@/server/logger";
import {
	matchesQueueFilters,
	type QueueStreamFilters,
	subscribeQueueEvents,
} from "@/server/queue/events";
import {
	countJobs,
	getConcurrency,
	isQueuePaused,
	listJobs,
} from "@/server/queue/queue.model";
import type { QueueJobType } from "@/server/queue/types";

const PAGE_SIZE = 25;

function validateJobType(typeParam: string): QueueJobType | undefined {
	const allowedTypes = [
		"project.create",
		"project.delete",
		"projects.deleteAllForUser",
		"docker.composeUp",
		"docker.waitReady",
		"docker.ensureRunning",
		"docker.stop",
		"opencode.sessionCreate",
		"opencode.sendInitialPrompt",
		"opencode.sendUserPrompt",
		"production.build",
		"production.start",
		"production.waitReady",
		"production.stop",
		"app.update",
		"app.restart",
	] as const;
	return allowedTypes.includes(
		typeParam as unknown as (typeof allowedTypes)[number],
	)
		? (typeParam as QueueJobType)
		: undefined;
}

function validateJobState(stateParam: string): QueueJob["state"] | undefined {
	const allowedStates = [
		"queued",
		"running",
		"succeeded",
		"failed",
		"cancelled",
	] as const;
	return allowedStates.includes(
		stateParam as unknown as (typeof allowedStates)[number],
	)
		? (stateParam as QueueJob["state"])
		: undefined;
}

export const GET: APIRoute = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const url = new URL(request.url);
	const page = Math.max(
		1,
		parseInt(url.searchParams.get("page") ?? "1", 10) || 1,
	);
	const offset = (page - 1) * PAGE_SIZE;
	const filters: QueueStreamFilters & { limit: number; offset: number } = {
		limit: PAGE_SIZE,
		offset,
	};

	const state = validateJobState(url.searchParams.get("state") ?? "");
	const type = validateJobType(url.searchParams.get("type") ?? "");
	const projectId = url.searchParams.get("projectId") ?? "";
	const q = url.searchParams.get("q") ?? "";
	if (state) filters.state = state;
	if (type) filters.type = type;
	if (projectId) filters.projectId = projectId;
	if (q) filters.q = q;

	const encoder = new TextEncoder();
	const headers = new Headers({
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
		"X-Accel-Buffering": "no",
	});

	const stream = new ReadableStream({
		start(controller) {
			let isClosed = false;
			const sendSnapshot = async (type: "init" | "update") => {
				const [jobs, totalCount, paused, concurrency] = await Promise.all([
					listJobs(filters),
					countJobs(filters),
					isQueuePaused(),
					getConcurrency(),
				]);
				if (isClosed) return;
				const totalPages = Math.ceil(totalCount / PAGE_SIZE);
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ type, jobs, paused, concurrency, pagination: { page, pageSize: PAGE_SIZE, totalCount, totalPages }, timestamp: new Date().toISOString() })}\n\n`,
					),
				);
			};

			void sendSnapshot("init");

			const keepAliveTimer = setInterval(() => {
				if (isClosed) return;
				controller.enqueue(encoder.encode(": keep-alive\n\n"));
			}, 15_000);

			const unsubscribe = subscribeQueueEvents((event) => {
				if (!matchesQueueFilters(filters, event)) return;
				void sendSnapshot("update").catch((error) => {
					logger.error({ error, filters }, "Failed to push queue jobs update");
				});
			});

			const cleanup = () => {
				if (isClosed) return;
				isClosed = true;
				unsubscribe();
				clearInterval(keepAliveTimer);
				try {
					controller.close();
				} catch {}
			};

			request.signal.addEventListener("abort", cleanup);
		},
	});

	return new Response(stream, { headers });
};
