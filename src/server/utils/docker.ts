import { existsSync, readFileSync } from "node:fs";

export function isRunningInDocker(): boolean {
	if (process.env.DOCE_NETWORK) {
		return true;
	}

	if (existsSync("/.dockerenv")) {
		return true;
	}

	try {
		const cgroup = readFileSync("/proc/1/cgroup", "utf8");
		return cgroup.includes("docker") || cgroup.includes("containerd");
	} catch {
		return false;
	}
}
