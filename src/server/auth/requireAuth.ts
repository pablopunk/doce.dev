import type { AstroCookies } from "astro";
import type { User } from "@/server/db/schema";
import { SESSION_COOKIE_NAME } from "./constants";
import { validateSession } from "./sessions";

export type AuthResult =
	| { ok: true; user: User }
	| { ok: false; response: Response };

export async function requireAuth(cookies: AstroCookies): Promise<AuthResult> {
	const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!sessionToken) {
		return {
			ok: false,
			response: new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		};
	}

	const session = await validateSession(sessionToken);
	if (!session) {
		return {
			ok: false,
			response: new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		};
	}

	return { ok: true, user: session.user };
}
