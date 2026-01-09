import { defineMiddleware } from "astro:middleware";
import {
	cleanupExpiredSessions,
	validateSession,
} from "@/server/auth/sessions";
import { db } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { ensureGlobalPnpmVolume } from "@/server/docker/compose";
import { ensureQueueWorkerStarted } from "@/server/queue/start";

ensureQueueWorkerStarted();
ensureGlobalPnpmVolume();
cleanupExpiredSessions().catch((error) => {
	console.error("Failed to cleanup expired sessions:", error);
});

const SESSION_COOKIE_NAME = "doce_session";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/setup", "/login"];

// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ["/setup", "/login"];

// Routes that handle their own authentication (API routes and Actions)
const SELF_AUTH_PREFIXES = ["/api/", "/_actions/"];

// Routes that should always be accessible (bypasses setup check redirects)
const ALWAYS_ACCESSIBLE = ["/api/setup", "/_actions/setup.createAdmin/"];

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	// Check if setup is needed (no users exist)
	const existingUsers = await db.select().from(users).limit(1);
	const needsSetup = existingUsers.length === 0;

	// Check if this is a route that should always be accessible
	const isAlwaysAccessible = ALWAYS_ACCESSIBLE.some(
		(path) => pathname === path,
	);

	// If needs setup and not on setup page or always-accessible route, redirect
	if (needsSetup && pathname !== "/setup" && !isAlwaysAccessible) {
		return context.redirect("/setup");
	}

	// If setup done and on setup page, redirect to login or dashboard
	// But allow setup.createAdmin action to work even after setup is done
	if (!needsSetup && pathname === "/setup" && !isAlwaysAccessible) {
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
