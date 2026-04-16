import * as path from "node:path";
import type { APIRoute } from "astro";
import { requireAuth } from "@/server/auth/requireAuth";
import {
	ensureLogStreaming,
	readLogFromOffset,
	readLogTail,
} from "@/server/docker/logs";
import { logger } from "@/server/logger";
import { getProjectProductionPath } from "@/server/projects/paths";
import {
	getProjectById,
	isProjectOwnedByUser,
} from "@/server/projects/projects.model";

const KEEP_ALIVE_INTERVAL_MS = 15_000;
const POLL_INTERVAL_MS = 1_000;

export const GET: APIRoute = async ({ params, url, cookies }) => {
	const auth = await requireAuth(cookies);
	if (!auth.ok) return auth.response;

	const projectId = params.id;
	if (!projectId) {
		return new Response("Project ID required", { status: 400 });
	}

	const isOwner = await isProjectOwnedByUser(projectId, auth.user.id);
	if (!isOwner) {
		return new Response("Not found", { status: 404 });
	}

	const project = await getProjectById(projectId);
	if (!project) {
		return new Response("Not found", { status: 404 });
	}

	if (!project.productionHash) {
		return new Response("No production deployment found", { status: 404 });
	}

	void ensureLogStreaming({
		kind: "production",
		projectId,
		projectPath: getProjectProductionPath(projectId, project.productionHash),
		productionHash: project.productionHash,
	}).catch((error) => {
		logger.error(
			{ error, projectId },
			"Failed to ensure production log streaming",
		);
	});

	const offsetParam = url.searchParams.get("offset");
	const requestedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : null;
	const logsDir = path.join(
		getProjectProductionPath(projectId, project.productionHash),
		"logs",
	);

	const encoder = new TextEncoder();
	let lastOffset = requestedOffset ?? 0;
	let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let isClosed = false;

	const stream = new ReadableStream({
		async start(controller) {
			const sendEvent = (data: object) => {
				if (isClosed) return;
				try {
					controller.enqueue(
						encoder.encode(
							`event: log.chunk\ndata: ${JSON.stringify(data)}\n\n`,
						),
					);
				} catch {
					// Stream closed
				}
			};

			const sendKeepAlive = () => {
				if (isClosed) return;
				try {
					controller.enqueue(encoder.encode(": keep-alive\n\n"));
				} catch {
					// Stream closed
				}
			};

			if (requestedOffset === null) {
				const { content, offset, truncated } = await readLogTail(logsDir);
				lastOffset = offset;
				sendEvent({
					projectId,
					offset: 0,
					nextOffset: offset,
					text: content,
					truncated,
				});
			} else if (requestedOffset >= 0) {
				const { content, nextOffset } = await readLogFromOffset(
					logsDir,
					requestedOffset,
				);
				lastOffset = nextOffset;
				if (content) {
					sendEvent({
						projectId,
						offset: requestedOffset,
						nextOffset,
						text: content,
						truncated: false,
					});
				}
			}

			pollTimer = setInterval(async () => {
				if (isClosed) return;

				try {
					const { content, nextOffset } = await readLogFromOffset(
						logsDir,
						lastOffset,
					);
					if (content) {
						sendEvent({
							projectId,
							offset: lastOffset,
							nextOffset,
							text: content,
							truncated: false,
						});
						lastOffset = nextOffset;
					}
				} catch {
					// Ignore read errors
				}
			}, POLL_INTERVAL_MS);

			keepAliveTimer = setInterval(sendKeepAlive, KEEP_ALIVE_INTERVAL_MS);
		},

		cancel() {
			isClosed = true;
			if (keepAliveTimer) clearInterval(keepAliveTimer);
			if (pollTimer) clearInterval(pollTimer);
		},
	});

	return new Response(stream, {
		status: 200,
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
};
