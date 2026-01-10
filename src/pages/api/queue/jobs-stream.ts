import type { APIRoute } from "astro";
import type { QueueJob } from "@/server/db/schema";
import {
	countJobs,
	getConcurrency,
	isQueuePaused,
	listJobs,
} from "@/server/queue/queue.model";
import { type QueueJobType } from "@/server/queue/types";

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
	] as const;
	return allowedTypes.includes(typeParam as any)
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
	return allowedStates.includes(stateParam as any)
		? (stateParam as QueueJob["state"])
		: undefined;
}

export const GET: APIRoute = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}

	const url = new URL(request.url);
	const stateParam = url.searchParams.get("state") ?? "";
	const typeParam = url.searchParams.get("type") ?? "";
	const projectIdParam = url.searchParams.get("projectId") ?? "";
	const qParam = url.searchParams.get("q") ?? "";
	const pageParam = url.searchParams.get("page") ?? "1";

	const page = Math.max(1, parseInt(pageParam, 10) || 1);
	const offset = (page - 1) * PAGE_SIZE;

	const state = validateJobState(stateParam);
	const type = validateJobType(typeParam);

	const headers = new Headers({
		"Content-Type": "text/event-stream",
		"Cache-Control": "no-cache",
		Connection: "keep-alive",
	});

	const encoder = new TextEncoder();
	let isClosed = false;
	let pollInterval: NodeJS.Timeout | null = null;
	const KEEP_ALIVE_INTERVAL_MS = 15_000;

	const stream = new ReadableStream({
		async start(controller) {
			const sendKeepAlive = () => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(": keep-alive\n\n"));
				} catch {
					// Stream closed
				}
			};

			const keepAliveTimer = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL_MS);

			try {
				const filters: any = { limit: PAGE_SIZE, offset };
				if (state) filters.state = state;
				if (type) filters.type = type;
				if (projectIdParam) filters.projectId = projectIdParam;
				if (qParam) filters.q = qParam;

				const jobs = await listJobs(filters);
				const totalCount = await countJobs(filters);
				const paused = await isQueuePaused();
				const concurrency = await getConcurrency();
				const totalPages = Math.ceil(totalCount / PAGE_SIZE);

				const data = {
					type: "init",
					jobs,
					paused,
					concurrency,
					pagination: { page, pageSize: PAGE_SIZE, totalCount, totalPages },
					timestamp: new Date().toISOString(),
				};

				try {
					controller.enqueue(
						encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
					);
				} catch (err) {
					if (err instanceof TypeError && err.message.includes("closed"))
						return;
					throw err;
				}

				pollInterval = setInterval(async () => {
					if (isClosed) {
						if (pollInterval) {
							clearInterval(pollInterval);
							pollInterval = null;
						}
						return;
					}

					try {
						const updatedJobs = await listJobs(filters);
						const updatedTotalCount = await countJobs(filters);
						const updatedPaused = await isQueuePaused();
						const updatedConcurrency = await getConcurrency();
						const updatedTotalPages = Math.ceil(updatedTotalCount / PAGE_SIZE);

						const updateData = {
							type: "update",
							jobs: updatedJobs,
							paused: updatedPaused,
							concurrency: updatedConcurrency,
							pagination: {
								page,
								pageSize: PAGE_SIZE,
								totalCount: updatedTotalCount,
								totalPages: updatedTotalPages,
							},
							timestamp: new Date().toISOString(),
						};

						if (!isClosed) {
							try {
								controller.enqueue(
									encoder.encode(`data: ${JSON.stringify(updateData)}\n\n`),
								);
							} catch (err) {
								if (err instanceof TypeError && err.message.includes("closed"))
									return;
								throw err;
							}
						}
					} catch (err) {
						console.error("Error polling queue jobs:", err);
					}
				}, 2000);

				request.signal?.addEventListener("abort", () => {
					isClosed = true;
					if (pollInterval) {
						clearInterval(pollInterval);
						pollInterval = null;
					}
					clearInterval(keepAliveTimer);
					controller.close();
				});
			} catch (err) {
				console.error("Error in queue jobs stream:", err);
				controller.error(err);
			}
		},

		cancel() {
			isClosed = true;
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
		},
	});

	return new Response(stream, { headers });
};
