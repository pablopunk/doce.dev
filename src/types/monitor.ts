export interface ContainerStats {
	name: string;
	service: "preview" | "opencode" | "production" | "unknown";
	projectId: string | null;
	cpuPercent: number;
	memPercent: number;
	memUsage: string;
	pids: number;
}

export interface MonitorSnapshot {
	containers: ContainerStats[];
	timestamp: string;
}
