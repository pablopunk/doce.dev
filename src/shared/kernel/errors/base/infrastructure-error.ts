import { AppError } from "./app-error";

/**
 * Base class for infrastructure errors (DB, Docker, File System, etc.)
 */
export abstract class InfrastructureError extends AppError {
  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, context);
  }
}
