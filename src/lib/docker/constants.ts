/**
 * Docker-related constants
 */

export const DOCKER_CONSTANTS = {
	PREVIEW_CONTAINER_PREFIX: "doce-preview",
	DEPLOYMENT_CONTAINER_PREFIX: "doce-deploy",
	NETWORK_NAME: "doce-network",
	CONTAINER_PORT: 3000,
	PORT_RANGE: {
		MIN: 10000,
		MAX: 20000,
	},
} as const;
