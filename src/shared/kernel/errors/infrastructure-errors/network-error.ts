import { InfrastructureError } from "../base/infrastructure-error";

export class NetworkError extends InfrastructureError {
  constructor(message: string, originalError?: Error) {
    super(
      message, 
      "NETWORK_ERROR", 
      500,
      { originalError: originalError?.message }
    );
  }
}
