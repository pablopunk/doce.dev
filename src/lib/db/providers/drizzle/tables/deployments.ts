/**
 * Deployment operations - Basic CRUD
 * Pure CRUD - no business logic
 */

import { eq, desc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../db";
import * as schema from "../schema";

export const deployments = {
	create: (data: schema.NewDeploymentInDatabase) => {
		const id = data.id || randomUUID();
		db.insert(schema.deployments)
			.values({ ...data, id })
			.run();
		return db
			.select()
			.from(schema.deployments)
			.where(eq(schema.deployments.id, id))
			.get();
	},

	getById: (id: string) => {
		return db
			.select()
			.from(schema.deployments)
			.where(eq(schema.deployments.id, id))
			.get();
	},

	getByProjectId: (projectId: string) => {
		return db
			.select()
			.from(schema.deployments)
			.where(eq(schema.deployments.projectId, projectId))
			.orderBy(desc(schema.deployments.createdAt))
			.all();
	},

	update: (id: string, data: Partial<schema.NewDeploymentInDatabase>) => {
		db.update(schema.deployments)
			.set({ ...data, updatedAt: sql`CURRENT_TIMESTAMP` })
			.where(eq(schema.deployments.id, id))
			.run();
		return db
			.select()
			.from(schema.deployments)
			.where(eq(schema.deployments.id, id))
			.get();
	},

	delete: (id: string) => {
		return db
			.delete(schema.deployments)
			.where(eq(schema.deployments.id, id))
			.run();
	},
};
