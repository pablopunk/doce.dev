/**
 * DTO for creating a project
 */
export interface CreateProjectDto {
	name: string;
	description?: string;
	userId?: string;
}

export interface CreateProjectResultDto {
	id: string;
	name: string;
	description: string | null;
	status: string;
	createdAt: string;
}
