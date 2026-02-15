import { defineMiddleware } from "astro:middleware";
import {
	cleanupExpiredSessions,
	validateSession,
} from "@/server/auth/sessions";
import { db } from "@/server/db/client";
import { ensureDatabaseReady } from "@/server/db/ensure-db";
import { users } from "@/server/db/schema";
import {
	ensureDoceSharedNetwork,
	ensureGlobalPnpmVolume,
} from "@/server/docker/compose";
import { ensureQueueWorkerStarted } from "@/server/queue/start";

let startupInitialized = false;
async function ensureInitialized() {
	if (startupInitialized) return;
	try {
		await ensureDatabaseReady();
		ensureQueueWorkerStarted();
		ensureDoceSharedNetwork();
		ensureGlobalPnpmVolume();
		startupInitialized = true;
	} catch (error) {
		console.error("[Middleware] Initial startup failed:", error);
	}
}

cleanupExpiredSessions().catch((error) => {
	console.error("Failed to cleanup expired sessions:", error);
});

const SETUP_CHECK_INTERVAL_MS = 1_000;
let setupCheckCache: { needsSetup: boolean; timestamp: number } | null = null;

async function getSetupNeeded(): Promise<boolean> {
	// Await initialization here instead of at the top level
	await ensureInitialized();

	const now = Date.now();
	if (
		setupCheckCache &&
		now - setupCheckCache.timestamp < SETUP_CHECK_INTERVAL_MS
	) {
		return setupCheckCache.needsSetup;
	}

	try {
		const existingUsers = await db.select().from(users).limit(1);
		const needsSetup = existingUsers.length === 0;
		setupCheckCache = { needsSetup, timestamp: now };
		return needsSetup;
	} catch (error) {
		console.error("[Middleware] Database check failed:", error);
		// If query fails, it might be because the table doesn't exist (needs setup)
		return true;
	}
}

const SESSION_COOKIE_NAME = "doce_session";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/setup", "/login"];

// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = ["/setup", "/login"];

// Routes that handle their own authentication (API routes and Actions)
const SELF_AUTH_PREFIXES = ["/api/", "/_actions/"];

// Routes that should always be accessible (bypasses setup check redirects)
const ALWAYS_ACCESSIBLE = ["/api/setup", "/_actions/setup.createAdmin"];

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname: rawPathname } = context.url;
	// Normalize pathname by removing trailing slash (except for root)
	const pathname = rawPathname === "/" ? "/" : rawPathname.replace(/\/$/, "");

	// Check if setup is needed (no users exist)
	const needsSetup = await getSetupNeeded();
	if (needsSetup) {
		console.log("[Middleware] No users found. Redirecting to setup.");
	}

	// Routes that should always be accessible
	const isAlwaysAccessible = ALWAYS_ACCESSIBLE.some((path) => {
		const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");
		return pathname === normalizedPath;
	});

	// If needs setup and not on setup page or always-accessible route, redirect
	if (needsSetup) {
		if (pathname !== "/setup" && !isAlwaysAccessible) {
			console.log(
				`[Middleware] Setup needed, redirecting from ${pathname} to /setup`,
			);
			return context.redirect("/setup");
		}
		return next();
	}

	// If setup done and on setup page, redirect to dashboard or login
	if (pathname === "/setup" && !isAlwaysAccessible) {
		const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
		if (sessionToken) {
			const session = await validateSession(sessionToken);
			if (session) return context.redirect("/");
		}
		return context.redirect("/login");
	}

	// Get session from cookie
	const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
	let user = null;

	if (sessionToken) {
		try {
			const session = await validateSession(sessionToken);
			if (session) {
				user = session.user;
			} else {
				context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
			}
		} catch (_error) {
			context.cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
		}
	}

	context.locals.user = user;

	// Redirect logged-in users away from login/setup
	if (user && AUTH_ROUTES.includes(pathname)) {
		return context.redirect("/");
	}

	// Skip auth for API/Actions
	const isSelfAuthRoute = SELF_AUTH_PREFIXES.some((prefix) =>
		pathname.startsWith(prefix),
	);

	// Redirect not-logged-in users to login
	if (!user && !PUBLIC_ROUTES.includes(pathname) && !isSelfAuthRoute) {
		return context.redirect("/login");
	}

	return next();
});
