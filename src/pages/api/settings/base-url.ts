import type { APIRoute } from "astro";
import { requireAuth } from "@/server/auth/requireAuth";
import { getInstanceBaseUrl } from "@/server/settings/instance.settings";

export const GET: APIRoute = async ({ cookies }) => {
	const auth = await requireAuth(cookies);
	if (!auth.ok) return auth.response;

	const baseUrl = await getInstanceBaseUrl();

	return new Response(JSON.stringify({ baseUrl }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
};
