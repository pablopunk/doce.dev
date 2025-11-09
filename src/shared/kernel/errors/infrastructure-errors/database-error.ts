import { InfrastructureError } from "../base/infrastructure-error";

export class DatabaseError extends InfrastructureError {
	constructor(message: string, originalError?: Error) {
		super(message, "DATABASE_ERROR", 500, {
			originalError: originalError?.message,
		});
	}
}
