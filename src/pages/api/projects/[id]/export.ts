import type { APIRoute } from "astro";
import { requireAuth } from "@/server/auth/requireAuth";
import { logger } from "@/server/logger";
import { exportProjectPreviewSource } from "@/server/projects/export";
import { getProjectById } from "@/server/projects/projects.model";

export const GET: APIRoute = async ({ params, cookies }) => {
	const auth = await requireAuth(cookies);
	if (!auth.ok) {
		return auth.response;
	}

	const projectId = params.id;
	if (!projectId) {
		return new Response(JSON.stringify({ error: "Project ID required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const project = await getProjectById(projectId);
		if (!project || project.ownerUserId !== auth.user.id) {
			return new Response(JSON.stringify({ error: "Not found" }), {
				status: 404,
				headers: { "Content-Type": "application/json" },
			});
		}

		const archive = await exportProjectPreviewSource(project);
		return new Response(archive.buffer, {
			status: 200,
			headers: {
				"Content-Type": "application/zip",
				"Content-Disposition": `attachment; filename="${archive.fileName}"`,
				"Content-Length": String(archive.buffer.byteLength),
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		logger.error({ error, projectId }, "[ProjectExport] Export failed");
		const message = error instanceof Error ? error.message : "Internal error";
		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
