import fs from "node:fs/promises";
import path from "node:path";
import { tool } from "@opencode-ai/plugin";

const SECTION_PREFIX = {
	all: null,
	app: "[app]",
	docker: "[docker]",
	host: "[host]",
};

function splitLines(content) {
	return content.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

export default tool({
	description:
		"Read recent preview server logs for this doce.dev project. Supports combined logs or only app/docker/host lines.",
	args: {
		lines: tool.schema
			.number()
			.int()
			.min(1)
			.max(500)
			.optional()
			.describe("How many recent log lines to return. Default: 200."),
		section: tool.schema
			.enum(["all", "app", "docker", "host"])
			.optional()
			.describe("Which log section to read. Default: all."),
	},
	async execute(args, context) {
		const lines = args.lines ?? 200;
		const section = args.section ?? "all";
		const logPath = path.join(context.directory, "logs", "docker.log");

		context.metadata({
			title: `Reading ${section} server logs`,
			metadata: { lines, section },
		});

		let content;
		try {
			content = await fs.readFile(logPath, "utf-8");
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				return `No server logs found yet at ${logPath}.`;
			}

			return `Failed to read server logs at ${logPath}: ${error instanceof Error ? error.message : String(error)}`;
		}

		let logLines = splitLines(content);
		const prefix = SECTION_PREFIX[section];
		if (prefix) {
			logLines = logLines.filter((line) => line.startsWith(prefix));
		}

		if (logLines.length === 0) {
			return `No ${section} log lines found in ${logPath}.`;
		}

		const tail = logLines.slice(-lines);
		return [
			`Showing ${tail.length} of ${logLines.length} ${section} log lines from ${logPath}:`,
			...tail,
		].join("\n");
	},
});
