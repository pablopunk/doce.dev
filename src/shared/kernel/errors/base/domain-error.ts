import { AppError } from "./app-error";

/**
 * Base class for domain/business logic errors
 */
export abstract class DomainError extends AppError {
  constructor(
    message: string,
    code: string,
    statusCode: number = 400,
    context?: Record<string, unknown>
  ) {
    super(message, code, statusCode, context);
  }
}
