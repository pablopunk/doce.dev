/**
 * Message operations - Basic CRUD
 * Pure CRUD - no business logic
 */

import { eq, asc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../db";
import * as schema from "../schema";

export const messages = {
	create: (data: schema.NewMessageInDatabase) => {
		const id = data.id || randomUUID();
		db.insert(schema.messages)
			.values({ ...data, id })
			.run();
		return db
			.select()
			.from(schema.messages)
			.where(eq(schema.messages.id, id))
			.get();
	},

	getById: (id: string) => {
		return db
			.select()
			.from(schema.messages)
			.where(eq(schema.messages.id, id))
			.get();
	},

	getByConversationId: (conversationId: string) => {
		return db
			.select()
			.from(schema.messages)
			.where(eq(schema.messages.conversationId, conversationId))
			.orderBy(asc(schema.messages.createdAt))
			.all();
	},

	update: (id: string, data: Partial<schema.NewMessageInDatabase>) => {
		db.update(schema.messages)
			.set(data)
			.where(eq(schema.messages.id, id))
			.run();
		return db
			.select()
			.from(schema.messages)
			.where(eq(schema.messages.id, id))
			.get();
	},

	delete: (id: string) => {
		return db.delete(schema.messages).where(eq(schema.messages.id, id)).run();
	},

	deleteMany: (ids: string[]) => {
		if (ids.length === 0) return { changes: 0 };
		return db
			.delete(schema.messages)
			.where(sql`${schema.messages.id} IN ${ids}`)
			.run();
	},
};
