/**
 * Project domain constants
 */

export const PROJECT_STATUS = {
	DRAFT: "draft",
	PREVIEW: "preview",
	DEPLOYED: "deployed",
	BUILDING: "building",
	ERROR: "error",
} as const;

export const DEFAULT_PROJECT_STATUS = PROJECT_STATUS.DRAFT;
