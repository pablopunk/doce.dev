import { logger } from "@/server/logger";
import { runCommand } from "@/server/utils/execAsync";
import type { ContainerStats } from "@/types/monitor";

interface DockerStatsRow {
	Name?: string;
	CPUPerc?: string;
	MemPerc?: string;
	MemUsage?: string;
	PIDs?: string;
}

function parseContainerName(name: string): {
	projectId: string | null;
	service: ContainerStats["service"];
} {
	// Production: doce-prod-{projectId}
	if (name.startsWith("doce-prod-")) {
		return {
			projectId: name.slice("doce-prod-".length),
			service: "production",
		};
	}

	// Preview: doce_{projectId}{sep}preview{sep}1
	const previewMatch = /^doce_(.+?)[_-]preview[_-]1$/.exec(name);
	if (previewMatch) {
		return { projectId: previewMatch[1] ?? null, service: "preview" };
	}

	// OpenCode: doce_{projectId}{sep}opencode{sep}1
	const opencodeMatch = /^doce_(.+?)[_-]opencode[_-]1$/.exec(name);
	if (opencodeMatch) {
		return { projectId: opencodeMatch[1] ?? null, service: "opencode" };
	}

	return { projectId: null, service: "unknown" };
}

function parsePercent(value: string | undefined): number {
	if (!value) return 0;
	const cleaned = value.replace("%", "").trim();
	const num = Number.parseFloat(cleaned);
	return Number.isNaN(num) ? 0 : num;
}

export async function getContainerStats(): Promise<ContainerStats[]> {
	const result = await runCommand(
		"docker stats --no-stream --format '{{json .}}'",
		{ timeout: 10000 },
	);

	if (!result.success) {
		logger.warn({ stderr: result.stderr }, "Failed to run docker stats");
		return [];
	}

	const lines = result.stdout
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	const containers: ContainerStats[] = [];

	for (const line of lines) {
		try {
			const row = JSON.parse(line) as DockerStatsRow;
			const name = row.Name ?? "";
			if (!name) continue;

			const { projectId, service } = parseContainerName(name);

			containers.push({
				name,
				service,
				projectId,
				cpuPercent: parsePercent(row.CPUPerc),
				memPercent: parsePercent(row.MemPerc),
				memUsage: row.MemUsage ?? "N/A",
				pids: Number.parseInt(row.PIDs ?? "0", 10) || 0,
			});
		} catch {
			// Skip malformed lines
		}
	}

	return containers;
}
