import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/server/db/client";
import { sessions, type User, users } from "@/server/db/schema";

const SESSION_EXPIRY_DAYS = 30;
const TOKEN_LENGTH = 32;

function generateToken(): string {
	return randomBytes(TOKEN_LENGTH).toString("hex");
}

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
	const token = generateToken();
	const tokenHash = hashToken(token);
	const now = new Date();
	const expiresAt = new Date(
		now.getTime() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
	);

	await db.insert(sessions).values({
		id: randomBytes(16).toString("hex"),
		userId,
		tokenHash,
		createdAt: now,
		expiresAt,
	});

	return token;
}

export async function validateSession(
	token: string,
): Promise<{ user: User } | null> {
	const tokenHash = hashToken(token);
	const now = new Date();

	const result = await db
		.select({
			session: sessions,
			user: users,
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
		.limit(1);

	const row = result[0];
	if (!row) {
		return null;
	}

	return { user: row.user };
}

export async function invalidateSession(token: string): Promise<void> {
	const tokenHash = hashToken(token);
	await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function cleanupExpiredSessions(): Promise<void> {
	const now = new Date();
	await db.delete(sessions).where(lt(sessions.expiresAt, now));
}
