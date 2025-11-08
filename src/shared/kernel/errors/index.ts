// Base errors
export { AppError } from "./base/app-error";
export { DomainError } from "./base/domain-error";
export { InfrastructureError } from "./base/infrastructure-error";

// Domain errors
export { ValidationError } from "./domain-errors/validation-error";
export { NotFoundError } from "./domain-errors/not-found-error";
export { ConflictError } from "./domain-errors/conflict-error";
export { BusinessRuleError } from "./domain-errors/business-rule-error";

// Infrastructure errors
export { DatabaseError } from "./infrastructure-errors/database-error";
export { DockerError } from "./infrastructure-errors/docker-error";
export { FileSystemError } from "./infrastructure-errors/file-system-error";
export { NetworkError } from "./infrastructure-errors/network-error";
