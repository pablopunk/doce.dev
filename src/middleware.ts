import { defineMiddleware, sequence } from "astro:middleware";
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
import { ensureEffectQueueWorkerStarted } from "@/server/effect";
import { logger } from "@/server/logger";

let startupInitialized = false;
async function ensureInitialized() {
	if (startupInitialized) return;
	try {
		await ensureDatabaseReady();
		ensureEffectQueueWorkerStarted();
		await ensureDoceSharedNetwork();
		await ensureGlobalPnpmVolume();
		startupInitialized = true;
	} catch (error) {
		logger.error({ error }, "[Middleware] Initial startup failed");
	}
}

cleanupExpiredSessions().catch((error) => {
	logger.error({ error }, "Failed to cleanup expired sessions");
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
		logger.error({ error }, "[Middleware] Database check failed");
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

const securityHeaders = defineMiddleware(async (_context, next) => {
	const response = await next();

	if (!response.headers.get("X-Frame-Options")) {
		response.headers.set("X-Frame-Options", "SAMEORIGIN");
		response.headers.set("X-Content-Type-Options", "nosniff");
		response.headers.set("X-XSS-Protection", "1; mode=block");
		response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
		response.headers.set(
			"Permissions-Policy",
			"camera=(), microphone=(), geolocation=()",
		);

		if (import.meta.env.PROD) {
			response.headers.set(
				"Strict-Transport-Security",
				"max-age=31536000; includeSubDomains; preload",
			);
		}
	}

	return response;
});

const authMiddleware = defineMiddleware(async (context, next) => {
	const { pathname: rawPathname } = context.url;
	const pathname = rawPathname === "/" ? "/" : rawPathname.replace(/\/$/, "");

	const needsSetup = await getSetupNeeded();
	if (needsSetup) {
		logger.info("[Middleware] No users found. Redirecting to setup.");
	}

	const isAlwaysAccessible = ALWAYS_ACCESSIBLE.some((path) => {
		const normalizedPath = path === "/" ? "/" : path.replace(/\/$/, "");
		return pathname === normalizedPath;
	});

	if (needsSetup) {
		if (pathname !== "/setup" && !isAlwaysAccessible) {
			logger.info(
				`[Middleware] Setup needed, redirecting from ${pathname} to /setup`,
			);
			return context.redirect("/setup");
		}
		return next();
	}

	if (pathname === "/setup" && !isAlwaysAccessible) {
		const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
		if (sessionToken) {
			const session = await validateSession(sessionToken);
			if (session) return context.redirect("/");
		}
		return context.redirect("/login");
	}

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

	if (user && AUTH_ROUTES.includes(pathname)) {
		return context.redirect("/");
	}

	const isSelfAuthRoute = SELF_AUTH_PREFIXES.some((prefix) =>
		pathname.startsWith(prefix),
	);

	if (!user && !PUBLIC_ROUTES.includes(pathname) && !isSelfAuthRoute) {
		return context.redirect("/login");
	}

	return next();
});

export const onRequest = sequence(securityHeaders, authMiddleware);
