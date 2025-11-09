import { InfrastructureError } from "../base/infrastructure-error";

export class FileSystemError extends InfrastructureError {
	constructor(message: string, originalError?: Error) {
		super(message, "FILE_SYSTEM_ERROR", 500, {
			originalError: originalError?.message,
		});
	}
}
