import type { Logger } from "@/shared/logging/logger.interface";
import { Project } from "../../../domain/models/project.model";
import type { IProjectRepository } from "../../../domain/repositories/project.repository.interface";
import type { ProjectValidationService } from "../../../domain/services/project-validation.service";
import type {
	CreateProjectDto,
	CreateProjectResultDto,
} from "./create-project.dto";

/**
 * Create Project Use Case
 * Orchestrates project creation flow
 */
export class CreateProjectUseCase {
	constructor(
		private readonly projectRepository: IProjectRepository,
		private readonly validationService: ProjectValidationService,
		private readonly logger: Logger,
	) {}

	async execute(dto: CreateProjectDto): Promise<CreateProjectResultDto> {
		this.logger.info("Creating project", { name: dto.name });

		// Validate
		this.validationService.validateName(dto.name);
		this.validationService.validateDescription(dto.description || null);

		// Sanitize
		const sanitizedName = this.validationService.sanitizeName(dto.name);

		// Create domain model
		const project = Project.create({
			name: sanitizedName,
			description: dto.description,
			userId: dto.userId,
		});

		// Persist
		await this.projectRepository.save(project);

		this.logger.info("Project created successfully", {
			id: project.id.toString(),
		});

		// Return DTO
		return {
			id: project.id.toString(),
			name: project.name,
			description: project.description,
			status: project.status,
			createdAt: project.createdAt.toISOString(),
		};
	}
}
