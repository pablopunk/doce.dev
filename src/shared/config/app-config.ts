import path from "path";

/**
 * Centralized application configuration
 * All environment variables and constants in one place
 */
export class AppConfig {
	// Database
	static getDatabasePath(): string {
		return process.env.DATABASE_PATH || "./data/doceapp.db";
	}

	static getDataDir(): string {
		return path.dirname(AppConfig.getDatabasePath());
	}

	// Projects
	static getProjectsDir(): string {
		return (
			process.env.PROJECTS_DIR || path.join(AppConfig.getDataDir(), "projects")
		);
	}

	// Docker
	static getDockerHost(): string {
		return process.env.DOCKER_HOST || "/var/run/docker.sock";
	}

	static getPortRange(): { min: number; max: number } {
		return {
			min: 10000,
			max: 20000,
		};
	}

	// Container
	static getContainerNetwork(): string {
		return "doce-network";
	}

	static getPreviewTimeout(): number {
		return 300; // 5 minutes
	}

	// Cleanup
	static getCleanupInterval(): number {
		return 60 * 60 * 1000; // 1 hour
	}

	static getMaxPreviewAge(): number {
		return 24 * 60 * 60 * 1000; // 24 hours
	}

	// Node
	static getNodeEnv(): string {
		return process.env.NODE_ENV || "development";
	}

	static isDevelopment(): boolean {
		return AppConfig.getNodeEnv() === "development";
	}

	static isProduction(): boolean {
		return AppConfig.getNodeEnv() === "production";
	}
}
