import type { APIRoute } from "astro";
import { getFiles } from "@/lib/db";
import { listProjectFiles } from "@/lib/file-system";

export const GET: APIRoute = async ({ params }) => {
	const id = params.id;
	if (!id) {
		return Response.json({ error: "Project id is required" }, { status: 400 });
	}

	const database = await getFiles(id);
	const filesystem = await listProjectFiles(id);

	return Response.json({ database, filesystem });
};
