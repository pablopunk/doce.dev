import type { MiddlewareHandler } from "astro";
import { Setup } from "@/domain/auth/models/user";
import "@/lib/startup";

export const onRequest: MiddlewareHandler = async (
	{ request, redirect },
	next,
) => {
	const { pathname } = new URL(request.url);

	// Log all action errors for debugging
	if (pathname.startsWith("/_actions/")) {
		try {
			const response = await next();
			// Log error responses
			if (response.status >= 400) {
				const clonedResponse = response.clone();
				try {
					const body = await clonedResponse.text();
					console.error(
						`[Action Error] ${pathname} - Status ${response.status}:`,
						body,
					);
				} catch (e) {
					console.error(
						`[Action Error] ${pathname} - Status ${response.status} (body could not be read)`,
					);
				}
			}
			return response;
		} catch (error) {
			console.error(`[Action Error] ${pathname}:`, error);
			throw error;
		}
	}

	// Allow setup routes
	if (pathname.startsWith("/setup") || pathname.startsWith("/api/setup")) {
		return next();
	}

	// Redirect to setup if not complete
	try {
		if (!Setup.isComplete()) {
			return redirect("/setup");
		}
	} catch (error) {
		console.error("[doce.dev] Middleware error:", error);
	}

	return next();
};
