import { DomainError } from "../base/domain-error";

export class ConflictError extends DomainError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, "CONFLICT", 409, context);
	}
}
