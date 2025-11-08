/**
 * Application-wide constants
 */

export const DOCKER_CONSTANTS = {
  PREVIEW_CONTAINER_PREFIX: "doce-preview",
  DEPLOYMENT_CONTAINER_PREFIX: "doce-deploy",
  NETWORK_NAME: "doce-network",
  CONTAINER_PORT: 3000,
} as const;

export const DATABASE_CONSTANTS = {
  TABLES: {
    CONFIG: "config",
    USERS: "users",
    PROJECTS: "projects",
    CONVERSATIONS: "conversations",
    MESSAGES: "messages",
    FILES: "files",
    DEPLOYMENTS: "deployments",
    MIGRATIONS: "migrations",
  },
} as const;

export const PROJECT_CONSTANTS = {
  DEFAULT_STATUS: "draft",
  STATUSES: {
    DRAFT: "draft",
    PREVIEW: "preview",
    DEPLOYED: "deployed",
  },
} as const;

export const AI_CONSTANTS = {
  PROVIDERS: {
    OPENROUTER: "openrouter",
    OPENAI: "openai",
    ANTHROPIC: "anthropic",
  },
} as const;
