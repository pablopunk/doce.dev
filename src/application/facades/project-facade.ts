import { SqliteProjectRepository } from "@/infrastructure/database/sqlite/repositories/project/sqlite-project.repository";
import { ProjectValidationService } from "@/domains/projects/domain/services/project-validation.service";
import { CreateProjectUseCase } from "@/domains/projects/application/use-cases/create-project/create-project.use-case";
import { LoggerFactory } from "@/shared/logging/logger-factory";
import type { Project } from "@/domains/projects/domain/models/project.model";
import type { Nullable } from "@/shared/kernel/types/common.types";

/**
 * Project Facade
 * Temporary adapter between old code and new architecture
 * Will be replaced by proper DI container
 */
class ProjectFacade {
  private repository = new SqliteProjectRepository();
  private validationService = new ProjectValidationService();
  private logger = LoggerFactory.create("ProjectFacade");

  async createProject(name: string, description?: string) {
    const useCase = new CreateProjectUseCase(
      this.repository,
      this.validationService,
      this.logger
    );

    return useCase.execute({ name, description });
  }

  async getProject(id: string): Promise<Nullable<Project>> {
    return this.repository.findById(id);
  }

  async getProjects(): Promise<Project[]> {
    return this.repository.findAll();
  }

  async deleteProject(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async updateProject(id: string, data: { preview_url?: string | null; deployed_url?: string | null; status?: string }) {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new Error("Project not found");
    }

    if (data.preview_url !== undefined) {
      if (data.preview_url) {
        project.updatePreviewUrl(data.preview_url);
      } else {
        project.clearPreview();
      }
    }

    if (data.deployed_url) {
      project.updateDeployedUrl(data.deployed_url);
    }

    await this.repository.save(project);
    return project;
  }
}

// Export singleton instance
export const projectFacade = new ProjectFacade();
