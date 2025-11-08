import { DomainError } from "../base/domain-error";

export class BusinessRuleError extends DomainError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "BUSINESS_RULE_VIOLATION", 422, context);
  }
}
