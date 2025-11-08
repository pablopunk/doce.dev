import type { Logger } from "./logger.interface";
import { ConsoleLogger } from "./loggers/console-logger";

/**
 * Factory for creating loggers
 */
export class LoggerFactory {
  static create(namespace?: string): Logger {
    return new ConsoleLogger(namespace);
  }
}
