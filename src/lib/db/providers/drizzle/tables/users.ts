/**
 * User operations - Basic CRUD
 * Pure CRUD - no business logic
 */

import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../schema";

export const users = {
	create: (username: string, passwordHash: string) => {
		const id = randomUUID();
		db.insert(schema.users).values({ id, username, passwordHash }).run();
		return db.select().from(schema.users).where(eq(schema.users.id, id)).get();
	},

	getById: (id: string) => {
		return db.select().from(schema.users).where(eq(schema.users.id, id)).get();
	},

	getByUsername: (username: string) => {
		return db
			.select()
			.from(schema.users)
			.where(eq(schema.users.username, username))
			.get();
	},

	getAll: () => {
		return db.select().from(schema.users).all();
	},

	count: () => {
		const result = db
			.select({ count: sql<number>`count(*)` })
			.from(schema.users)
			.get();
		return result?.count ?? 0;
	},

	delete: (id: string) => {
		return db.delete(schema.users).where(eq(schema.users.id, id)).run();
	},
};
