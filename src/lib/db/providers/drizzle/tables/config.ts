/**
 * Config operations - Simple key-value store
 * Pure CRUD - no business logic
 */

import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../schema";

export const config = {
	get: (key: string) => {
		return db
			.select()
			.from(schema.config)
			.where(eq(schema.config.key, key))
			.get();
	},

	set: (key: string, value: string) => {
		return db
			.insert(schema.config)
			.values({ key, value })
			.onConflictDoUpdate({
				target: schema.config.key,
				set: { value, updatedAt: sql`CURRENT_TIMESTAMP` },
			})
			.run();
	},

	delete: (key: string) => {
		return db.delete(schema.config).where(eq(schema.config.key, key)).run();
	},

	getAll: () => {
		return db.select().from(schema.config).all();
	},
};
