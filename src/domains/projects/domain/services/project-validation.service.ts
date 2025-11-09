import { ValidationError } from "@/shared/kernel/errors";

/**
 * Project Validation Service
 * Contains business validation rules
 */
export class ProjectValidationService {
	validateName(name: string): void {
		if (!name || name.trim().length === 0) {
			throw new ValidationError("Project name is required");
		}

		if (name.length < 3) {
			throw new ValidationError(
				"Project name must be at least 3 characters long",
			);
		}

		if (name.length > 100) {
			throw new ValidationError(
				"Project name must be less than 100 characters",
			);
		}

		if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
			throw new ValidationError(
				"Project name can only contain letters, numbers, spaces, hyphens, and underscores",
			);
		}
	}

	validateDescription(description: string | null): void {
		if (description && description.length > 500) {
			throw new ValidationError(
				"Project description must be less than 500 characters",
			);
		}
	}

	sanitizeName(name: string): string {
		return name.trim();
	}
}
