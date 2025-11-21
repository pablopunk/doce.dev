/**
 * User & Auth Model
 * Handles user management and setup flow
 */

import bcrypt from "bcryptjs";
import * as db from "@/lib/db";
import type { UserInDatabase } from "@/lib/db/providers/drizzle/schema";

// Domain types - always import from here, never from @/lib/db
export type UserModel = UserInDatabase;

export interface SetupStatus {
	setupComplete: boolean;
}

/**
 * User Model
 * Static methods for user management and authentication
 */
export class User {
	/**
	 * Create a new user
	 */
	static async create(username: string, password: string): Promise<UserModel> {
		const passwordHash = await bcrypt.hash(password, 10);
		const user = db.users.create(username, passwordHash);
		if (!user) throw new Error("Failed to create user");
		return user;
	}

	/**
	 * Get user by username
	 */
	static getByUsername(username: string): UserModel | null {
		const user = db.users.getByUsername(username);
		return user ?? null;
	}

	/**
	 * Verify user password
	 */
	static async verifyPassword(
		username: string,
		password: string,
	): Promise<boolean> {
		const user = User.getByUsername(username);
		if (!user) return false;

		return bcrypt.compare(password, user.passwordHash);
	}
}

/**
 * Setup Model
 * Handles initial application setup
 */
let setupCompleteCache: boolean | null = null;

export class Setup {
	/**
	 * Check if setup is complete
	 * Business logic: requires at least one user AND an AI provider configured
	 */
	static isComplete(): boolean {
		// Once setup is marked complete, we can avoid hitting the database on
		// every request and rely on an in-memory cache. This significantly
		// reduces contention during normal operation.
		if (setupCompleteCache === true) {
			return true;
		}

		// Check if setup_complete flag is set
		const configValue = db.config.get("setup_complete");
		if (configValue?.value === "true") {
			setupCompleteCache = true;
			return true;
		}

		// Check if we have at least one user
		const userCount = db.users.count();
		const hasUser = userCount > 0;

		// Check if AI provider is configured
		const hasEnvKey = Boolean(
			process.env.OPENAI_API_KEY ||
				process.env.ANTHROPIC_API_KEY ||
				process.env.OPENROUTER_API_KEY,
		);

		const providerConfig = db.config.get("ai_provider");
		const provider = providerConfig?.value;
		const hasConfigKey = provider
			? Boolean(db.config.get(`${provider}_api_key`)?.value)
			: false;
		const hasAI = hasEnvKey || (!!provider && hasConfigKey);

		const complete = hasUser && !!hasAI;
		if (complete) {
			setupCompleteCache = true;
		}

		return complete;
	}

	/**
	 * Get setup status
	 */
	static getStatus(): SetupStatus {
		return {
			setupComplete: Setup.isComplete(),
		};
	}

	/**
	 * Mark setup as complete
	 */
	static complete(): void {
		db.config.set("setup_complete", "true");
		// Update in-memory cache so subsequent middleware checks avoid DB.
		setupCompleteCache = true;
	}

	/**
	 * Configure AI provider
	 */
	static configureAI(provider: string, apiKey: string): void {
		if (Setup.isComplete()) {
			throw new Error("Setup already completed");
		}

		db.config.set("ai_provider", provider);
		db.config.set(`${provider}_api_key`, apiKey);
	}
}
