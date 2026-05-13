const SHARED_HELPER = `
import * as fs from "node:fs/promises";

const TOKEN_FILENAME = ".doce-internal-token";
const SEP = "/";

function resolveDirectory(context) {
	if (!context) return null;
	return (
		context.directory ||
		context.worktree ||
		context.cwd ||
		(context.session && (context.session.directory || context.session.worktree)) ||
		null
	);
}

async function readToken(directory) {
	try {
		const tokenPath = directory.replace(/\\/+$/, "") + SEP + TOKEN_FILENAME;
		const content = await fs.readFile(tokenPath, "utf-8");
		return content.trim() || null;
	} catch {
		return null;
	}
}

function extractProjectId(directory) {
	if (!directory || typeof directory !== "string") return null;
	const segments = directory.split(SEP).filter(Boolean);
	const previewIndex = segments.lastIndexOf("preview");
	if (previewIndex < 1) return null;
	return segments[previewIndex - 1] ?? null;
}

function getBaseUrl() {
	return process.env.DOCE_INTERNAL_BASE_URL || "http://127.0.0.1:4321";
}

async function callDoceInternal(action, context, extra) {
	const directory = resolveDirectory(context);
	if (!directory) {
		return {
			ok: false,
			error: "OpenCode context did not provide a directory",
			contextKeys: context ? Object.keys(context) : [],
		};
	}

	const projectId = extractProjectId(directory);
	if (!projectId) {
		return {
			ok: false,
			error: "Could not resolve projectId from session directory",
			directory,
		};
	}

	const token = await readToken(directory);
	if (!token) {
		return { ok: false, error: "Missing internal project token", directory };
	}

	const url = getBaseUrl() + "/api/internal/ai-tools/preview/" + action;
	const body = { projectId, token, ...(extra || {}) };

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});

	const text = await response.text();
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		parsed = { raw: text };
	}

	if (!response.ok) {
		return { ok: false, status: response.status, error: parsed?.error || text };
	}

	return parsed;
}
`.trim();

function toolFile(body: string): string {
	return `import { tool } from "@opencode-ai/plugin";\n${SHARED_HELPER}\n\n${body}\n`;
}

// NOTE: We intentionally do NOT declare an "args" field on these tool
// definitions. OpenCode 1.14.48 has a bug where any tool that declares an
// "args" field (even an empty {}) fails its first call with
// 'undefined is not an object (evaluating "g.split")' inside the runtime
// wrapper. Tools without "args" execute correctly. So these tools take no
// arguments from the model and read sensible defaults from the session
// context (directory + project token).

export const GET_DOCE_PREVIEW_STATUS_SOURCE = toolFile(`
export default tool({
	description:
		"Check whether the doce preview server is healthy and reachable. Returns container state and a human-readable summary. Use this first when the preview seems broken. Takes no arguments.",
	async execute(_args, context) {
		return callDoceInternal("status", context);
	},
});
`.trim());

export const READ_DOCE_PREVIEW_LOGS_SOURCE = toolFile(`
export default tool({
	description:
		"Read recent doce preview logs (last error line + a tail of recent log bytes). Use this to diagnose preview issues. Takes no arguments.",
	async execute(_args, context) {
		return callDoceInternal("logs", context, { mode: "tail", maxBytes: 4096 });
	},
});
`.trim());

export const RESTART_DOCE_PREVIEW_SOURCE = toolFile(`
export default tool({
	description:
		"Restart the doce preview container. Only call this after confirming via get_doce_preview_status and read_doce_preview_logs that the preview is actually unhealthy. Takes no arguments.",
	async execute(_args, context) {
		return callDoceInternal("restart", context, { reason: "Agent-triggered preview restart" });
	},
});
`.trim());

export const DOCE_PREVIEW_TOOL_FILES: Array<{
	filename: string;
	source: string;
}> = [
	{ filename: "get_doce_preview_status.ts", source: GET_DOCE_PREVIEW_STATUS_SOURCE },
	{ filename: "read_doce_preview_logs.ts", source: READ_DOCE_PREVIEW_LOGS_SOURCE },
	{ filename: "restart_doce_preview.ts", source: RESTART_DOCE_PREVIEW_SOURCE },
];
