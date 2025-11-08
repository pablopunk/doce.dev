import { InfrastructureError } from "../base/infrastructure-error";

export class DockerError extends InfrastructureError {
  constructor(message: string, originalError?: Error) {
    super(
      message, 
      "DOCKER_ERROR", 
      500,
      { originalError: originalError?.message }
    );
  }
}
