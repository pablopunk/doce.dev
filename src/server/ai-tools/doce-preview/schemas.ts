import { z } from "zod";

// ============================================================================
// get_doce_preview_status
// ============================================================================

export const getDocePreviewStatusInput = z.object({
	projectId: z.string().min(1),
});

export const getDocePreviewStatusOutput = z.object({
	ok: z.boolean(),
	projectId: z.string(),
	projectStatus: z.string(),
	preview: z.object({
		reachable: z.boolean(),
		url: z.string().optional(),
		httpStatus: z.number().int().optional(),
	}),
	containers: z.array(
		z.object({
			service: z.string(),
			state: z.string(),
			health: z.string().optional(),
		}),
	),
	logStreamingActive: z.boolean().optional(),
	summary: z.string(),
});

export type GetDocePreviewStatusInput = z.infer<
	typeof getDocePreviewStatusInput
>;
export type GetDocePreviewStatusOutput = z.infer<
	typeof getDocePreviewStatusOutput
>;

// ============================================================================
// read_doce_preview_logs
// ============================================================================

export const readDocePreviewLogsInput = z.object({
	projectId: z.string().min(1),
	mode: z.enum(["summary", "tail", "sinceOffset"]).default("summary"),
	maxBytes: z.number().int().min(256).max(16384).optional(),
	offset: z.number().int().min(0).optional(),
});

export const readDocePreviewLogsOutput = z.object({
	ok: z.boolean(),
	projectId: z.string(),
	mode: z.enum(["summary", "tail", "sinceOffset"]),
	content: z.string().optional(),
	nextOffset: z.number().int().optional(),
	truncated: z.boolean().optional(),
	extractedSignal: z.string().nullable().optional(),
	summary: z.string(),
});

export type ReadDocePreviewLogsInput = z.infer<
	typeof readDocePreviewLogsInput
>;
export type ReadDocePreviewLogsOutput = z.infer<
	typeof readDocePreviewLogsOutput
>;

// ============================================================================
// restart_doce_preview
// ============================================================================

export const restartDocePreviewInput = z.object({
	projectId: z.string().min(1),
	reason: z.string().max(300).optional(),
});

export const restartDocePreviewOutput = z.object({
	ok: z.boolean(),
	projectId: z.string(),
	restarted: z.boolean(),
	command: z.literal("docker compose restart preview"),
	previewReachableAfterRestart: z.boolean().optional(),
	summary: z.string(),
	error: z.string().optional(),
});

export type RestartDocePreviewInput = z.infer<
	typeof restartDocePreviewInput
>;
export type RestartDocePreviewOutput = z.infer<
	typeof restartDocePreviewOutput
>;
