import type { APIRoute } from "astro";
import { validateSession } from "@/server/auth/sessions";
import { getInstanceBaseUrl } from "@/server/settings/instance.settings";

const SESSION_COOKIE_NAME = "doce_session";

export const GET: APIRoute = async ({ cookies }) => {
	const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!sessionToken) {
		return new Response("Unauthorized", { status: 401 });
	}

	const session = await validateSession(sessionToken);
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const baseUrl = await getInstanceBaseUrl();

	return new Response(JSON.stringify({ baseUrl }), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
		},
	});
};
