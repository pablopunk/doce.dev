/**
 * Conversation operations - Basic CRUD
 * Pure CRUD - no business logic
 */

import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../db";
import * as schema from "../schema";

export const conversations = {
	create: (data: schema.NewConversationInDatabase) => {
		const id = data.id || randomUUID();
		db.insert(schema.conversations)
			.values({ ...data, id })
			.run();
		return db
			.select()
			.from(schema.conversations)
			.where(eq(schema.conversations.id, id))
			.get();
	},

	getById: (id: string) => {
		return db
			.select()
			.from(schema.conversations)
			.where(eq(schema.conversations.id, id))
			.get();
	},

	getByProjectId: (projectId: string) => {
		return db
			.select()
			.from(schema.conversations)
			.where(eq(schema.conversations.projectId, projectId))
			.get();
	},

	update: (id: string, data: Partial<schema.NewConversationInDatabase>) => {
		db.update(schema.conversations)
			.set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
			.where(eq(schema.conversations.id, id))
			.run();
		return db
			.select()
			.from(schema.conversations)
			.where(eq(schema.conversations.id, id))
			.get();
	},

	delete: (id: string) => {
		return db
			.delete(schema.conversations)
			.where(eq(schema.conversations.id, id))
			.run();
	},
};
