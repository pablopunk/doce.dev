/**
 * Semantic status color utilities for consistent styling across the application.
 * These map status values to CSS class names for status colors.
 */

export const statusColors = {
	error: {
		text: "text-status-error",
		bg: "bg-status-error-light",
		border: "border-status-error",
	},
	success: {
		text: "text-status-success",
		bg: "bg-status-success-light",
		border: "border-status-success",
	},
	warning: {
		text: "text-status-warning",
		bg: "bg-status-warning/10",
		border: "border-status-warning",
	},
	info: {
		text: "text-status-info",
		bg: "bg-status-info/10",
		border: "border-status-info",
	},
} as const;

export type StatusType = keyof typeof statusColors;

/**
 * Get color classes for a job state
 */
export function getJobStateColor(state: string): string {
	switch (state) {
		case "succeeded":
			return statusColors.success.text;
		case "failed":
			return statusColors.error.text;
		case "cancelled":
			return statusColors.warning.text;
		case "running":
		case "queued":
			return statusColors.info.text;
		default:
			return statusColors.info.text;
	}
}

/**
 * Get background and text color for a status badge
 */
export function getStatusBadgeColors(status: StatusType) {
	return statusColors[status];
}
