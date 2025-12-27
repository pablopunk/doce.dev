import { defineMiddleware } from "astro:middleware";
import { validateSession } from "@/server/auth/sessions";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { ensureGlobalPnpmVolume } from "@/server/docker/compose";
import { ensureQueueWorkerStarted } from "@/server/queue/start";

ensureQueueWorkerStarted();
ensureGlobalPnpmVolume();

const SESSION_COOKIE_NAME = "doce_session";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/setup", "/login"];

// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ["/setup", "/login"];

// Routes that handle their own authentication (API routes)
const SELF_AUTH_PREFIXES = ["/api/"];

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	// Check if setup is needed (no users exist)
	const existingUsers = await db.select().from(users).limit(1);
	const needsSetup = existingUsers.length === 0;

	// If needs setup and not on setup page, redirect
	if (needsSetup && pathname !== "/setup") {
		return context.redirect("/setup");
	}

	// If setup done and on setup page, redirect to login or dashboard
	if (!needsSetup && pathname === "/setup") {
		const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
		if (sessionToken) {
			const session = await validateSession(sessionToken);
			if (session) {
				return context.redirect("/");
			}
		}
		return context.redirect("/login");
	}

	// Get session from cookie
	const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
	let user = null;

	if (sessionToken) {
		const session = await validateSession(sessionToken);
		if (session) {
			user = session.user;
		} else {
			// Invalid session, clear cookie
			context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
		}
	}

	// Set user in locals for pages/actions to access
	context.locals.user = user;

	// If logged in and on auth routes, redirect to dashboard
	if (user && AUTH_ROUTES.includes(pathname)) {
		return context.redirect("/");
	}

	// Skip middleware auth for API routes (they handle auth internally)
	const isSelfAuthRoute = SELF_AUTH_PREFIXES.some((prefix) =>
		pathname.startsWith(prefix),
	);

	// If not logged in and on protected route, redirect to login
	if (!user && !PUBLIC_ROUTES.includes(pathname) && !isSelfAuthRoute) {
		return context.redirect("/login");
	}

	return next();
});
