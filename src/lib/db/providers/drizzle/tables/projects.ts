/**
 * Project operations - Basic CRUD
 * Pure CRUD - no business logic
 */

import { randomUUID } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../schema";

export const projects = {
	create: (data: schema.NewProjectInDatabase) => {
		const id = data.id || randomUUID();
		db.insert(schema.projects)
			.values({ ...data, id })
			.run();
		return db
			.select()
			.from(schema.projects)
			.where(eq(schema.projects.id, id))
			.get();
	},

	getById: (id: string) => {
		return db
			.select()
			.from(schema.projects)
			.where(eq(schema.projects.id, id))
			.get();
	},

	getAll: () => {
		return db
			.select()
			.from(schema.projects)
			.orderBy(desc(schema.projects.updatedAt))
			.all();
	},

	update: (id: string, data: Partial<schema.NewProjectInDatabase>) => {
		db.update(schema.projects)
			.set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
			.where(eq(schema.projects.id, id))
			.run();
		return db
			.select()
			.from(schema.projects)
			.where(eq(schema.projects.id, id))
			.get();
	},

	delete: (id: string) => {
		return db.delete(schema.projects).where(eq(schema.projects.id, id)).run();
	},
};
