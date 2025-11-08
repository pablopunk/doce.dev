import type { Project } from "../models/project.model";
import type { Nullable } from "@/shared/kernel/types/common.types";

/**
 * Project Repository Interface
 * Defines contract for project persistence
 * Infrastructure layer will implement this
 */
export interface IProjectRepository {
  findById(id: string): Promise<Nullable<Project>>;
  findAll(): Promise<Project[]>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}
