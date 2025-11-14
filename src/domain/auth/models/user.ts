/**
 * User & Auth Model
 * Handles user management and setup flow
 */

import * as db from "@/lib/db";
import bcrypt from "bcryptjs";

export interface UserData {
	id: string;
	username: string;
	password_hash: string;
	created_at: string;
}

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
	static async create(username: string, password: string): Promise<UserData> {
		const passwordHash = await bcrypt.hash(password, 10);
		const user = db.createUser(username, passwordHash);
		return user as UserData;
	}

	/**
	 * Get user by username
	 */
	static getByUsername(username: string): UserData | null {
		const user = db.getUserByUsername(username);
		return user as UserData | null;
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

		return bcrypt.compare(password, user.password_hash);
	}
}

/**
 * Setup Model
 * Handles initial application setup
 */
export class Setup {
	/**
	 * Check if setup is complete
	 */
	static isComplete(): boolean {
		return db.isSetupComplete();
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
		db.setConfig("setup_complete", "true");
	}

	/**
	 * Configure AI provider
	 */
	static configureAI(provider: string, apiKey: string): void {
		if (Setup.isComplete()) {
			throw new Error("Setup already completed");
		}

		db.setConfig("ai_provider", provider);
		db.setConfig(`${provider}_api_key`, apiKey);
	}
}
