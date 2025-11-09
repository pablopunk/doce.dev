import { Project } from "@/domains/projects/domain/models/project.model";
import type { IProjectRepository } from "@/domains/projects/domain/repositories/project.repository.interface";
import { DatabaseError, NotFoundError } from "@/shared/kernel/errors";
import type { Nullable } from "@/shared/kernel/types/common.types";
import { getDatabase } from "../../connection/sqlite-connection";

/**
 * SQLite implementation of Project Repository
 * Translates between domain models and database records
 */
export class SqliteProjectRepository implements IProjectRepository {
	async findById(id: string): Promise<Nullable<Project>> {
		try {
			const db = getDatabase();
			const row = db
				.prepare("SELECT * FROM projects WHERE id = ?")
				.get(id) as any;

			if (!row) {
				return null;
			}

			return Project.fromPersistence(row);
		} catch (error) {
			throw new DatabaseError(
				`Failed to find project by id: ${id}`,
				error instanceof Error ? error : undefined,
			);
		}
	}

	async findAll(): Promise<Project[]> {
		try {
			const db = getDatabase();
			const rows = db
				.prepare("SELECT * FROM projects ORDER BY updated_at DESC")
				.all() as any[];

			return rows.map((row) => Project.fromPersistence(row));
		} catch (error) {
			throw new DatabaseError(
				"Failed to find all projects",
				error instanceof Error ? error : undefined,
			);
		}
	}

	async save(project: Project): Promise<void> {
		try {
			const db = getDatabase();
			const data = project.toPersistence();

			// Check if exists
			const existing = db
				.prepare("SELECT id FROM projects WHERE id = ?")
				.get(data.id);

			if (existing) {
				// Update
				db.prepare(`
          UPDATE projects 
          SET 
            name = ?,
            description = ?,
            status = ?,
            preview_url = ?,
            deployed_url = ?,
            user_id = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
					data.name,
					data.description,
					data.status,
					data.preview_url,
					data.deployed_url,
					data.user_id,
					data.id,
				);
			} else {
				// Insert
				db.prepare(`
          INSERT INTO projects (
            id, name, description, status, preview_url, deployed_url, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
					data.id,
					data.name,
					data.description,
					data.status,
					data.preview_url,
					data.deployed_url,
					data.user_id,
				);
			}
		} catch (error) {
			throw new DatabaseError(
				`Failed to save project: ${project.id.toString()}`,
				error instanceof Error ? error : undefined,
			);
		}
	}

	async delete(id: string): Promise<void> {
		try {
			const db = getDatabase();
			const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);

			if (result.changes === 0) {
				throw new NotFoundError("Project", id);
			}
		} catch (error) {
			if (error instanceof NotFoundError) {
				throw error;
			}
			throw new DatabaseError(
				`Failed to delete project: ${id}`,
				error instanceof Error ? error : undefined,
			);
		}
	}
}
