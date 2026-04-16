import { logger } from "@/server/logger";
import { runCommand } from "@/server/utils/execAsync";

export interface TailscaleStatus {
	connected: boolean;
	hostname: string | null;
	tailnetName: string | null;
	tailscaleIp: string | null;
	magicDnsUrl: string | null;
}

interface TailscaleStatusJson {
	Self?: {
		HostName?: string;
		DNSName?: string;
		TailscaleIPs?: string[];
	};
	MagicDNSSuffix?: string;
	CurrentTailnet?: {
		Name?: string;
		MagicDNSSuffix?: string;
	};
}

export async function getTailscaleStatus(): Promise<TailscaleStatus> {
	const result = await runCommand("tailscale status --json", { timeout: 5000 });

	if (!result.success) {
		return {
			connected: false,
			hostname: null,
			tailnetName: null,
			tailscaleIp: null,
			magicDnsUrl: null,
		};
	}

	try {
		const json = JSON.parse(result.stdout) as TailscaleStatusJson;
		const self = json.Self;
		const hostname = self?.HostName ?? null;
		const dnsName = self?.DNSName?.replace(/\.$/, "") ?? null;
		const tailnetName =
			json.CurrentTailnet?.MagicDNSSuffix ?? json.MagicDNSSuffix ?? null;
		const tailscaleIp = self?.TailscaleIPs?.[0] ?? null;

		return {
			connected: true,
			hostname,
			tailnetName,
			tailscaleIp,
			magicDnsUrl: dnsName ? `https://${dnsName}` : null,
		};
	} catch (error) {
		logger.warn({ error }, "Failed to parse tailscale status JSON");
		return {
			connected: false,
			hostname: null,
			tailnetName: null,
			tailscaleIp: null,
			magicDnsUrl: null,
		};
	}
}
