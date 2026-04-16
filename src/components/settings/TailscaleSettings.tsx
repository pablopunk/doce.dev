import { actions } from "astro:actions";
import {
	Globe,
	Loader2,
	Network,
	ShieldCheck,
	Unplug,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TailscaleStatusData {
	installed: boolean;
	config: {
		enabled: boolean;
		authKey: string | null;
		hostname: string | null;
		tailnetName: string | null;
	} | null;
	status: {
		connected: boolean;
		hostname: string | null;
		tailnetName: string | null;
		tailscaleIp: string | null;
		magicDnsUrl: string | null;
	} | null;
}

function StatusBadge({ connected }: { connected: boolean }) {
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
				connected
					? "bg-green-500/10 text-green-600 dark:text-green-400"
					: "bg-muted text-muted-foreground"
			}`}
		>
			{connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
			{connected ? "Connected" : "Disconnected"}
		</span>
	);
}

function ConnectionInfo({
	status,
}: {
	status: NonNullable<TailscaleStatusData["status"]>;
}) {
	return (
		<div className="grid gap-3 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
			<div className="flex items-center gap-2">
				<Network className="size-4 text-muted-foreground" />
				<span className="text-muted-foreground">Hostname:</span>
				<span className="font-medium">{status.hostname}</span>
			</div>
			<div className="flex items-center gap-2">
				<Globe className="size-4 text-muted-foreground" />
				<span className="text-muted-foreground">Tailnet:</span>
				<span className="font-medium">{status.tailnetName}</span>
			</div>
			{status.magicDnsUrl && (
				<div className="flex items-center gap-2">
					<ShieldCheck className="size-4 text-muted-foreground" />
					<span className="text-muted-foreground">URL:</span>
					<a
						href={status.magicDnsUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium text-primary underline-offset-4 hover:underline"
					>
						{status.magicDnsUrl}
					</a>
				</div>
			)}
			{status.tailscaleIp && (
				<div className="flex items-center gap-2">
					<Network className="size-4 text-muted-foreground" />
					<span className="text-muted-foreground">IP:</span>
					<span className="font-mono text-xs">{status.tailscaleIp}</span>
				</div>
			)}
		</div>
	);
}

function ConnectForm({ onConnected }: { onConnected: () => void }) {
	const [authKey, setAuthKey] = useState("");
	const [hostname, setHostname] = useState("doce");
	const [isConnecting, setIsConnecting] = useState(false);

	const handleConnect = async () => {
		if (!authKey.trim()) return;
		setIsConnecting(true);

		try {
			const result = await actions.tailscale.connect({
				authKey: authKey.trim(),
				hostname: hostname.trim() || "doce",
			});

			if (result.error) {
				toast.error(result.error.message || "Failed to connect");
				return;
			}

			if (result.data?.serveWarning) {
				toast.warning(result.data.serveWarning);
			} else {
				toast.success("Connected to Tailscale");
			}

			setAuthKey("");
			onConnected();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to connect";
			toast.error(message);
		} finally {
			setIsConnecting(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="ts-auth-key">Auth Key</Label>
				<Input
					id="ts-auth-key"
					type="password"
					value={authKey}
					onChange={(e) => setAuthKey(e.target.value)}
					placeholder="tskey-auth-..."
					disabled={isConnecting}
				/>
				<div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
					<p className="font-medium text-foreground">
						Generate your key in the{" "}
						<a
							href="https://login.tailscale.com/admin/settings/keys"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary underline-offset-4 hover:underline"
						>
							Tailscale admin console
						</a>{" "}
						with these options:
					</p>
					<ul className="space-y-1 text-muted-foreground">
						<li>
							<span className="font-mono text-foreground">Reusable</span>{" "}
							<span className="text-amber-600 dark:text-amber-400">
								(required)
							</span>{" "}
							— each project creates its own tailnet node, so the key must be
							usable more than once
						</li>
						<li>
							<span className="font-mono text-foreground">Ephemeral</span>{" "}
							<span className="text-muted-foreground">(recommended)</span> —
							auto-removes project nodes from your tailnet when containers stop
						</li>
						<li>
							<span className="font-mono text-foreground">Pre-approved</span>{" "}
							<span className="text-muted-foreground">(recommended)</span> —
							skips manual approval if device approval is enabled on your
							tailnet
						</li>
					</ul>
				</div>
			</div>
			<div className="space-y-2">
				<Label htmlFor="ts-hostname">Hostname</Label>
				<Input
					id="ts-hostname"
					value={hostname}
					onChange={(e) => setHostname(e.target.value)}
					placeholder="doce"
					disabled={isConnecting}
				/>
				<p className="text-xs text-muted-foreground">
					The main app will be available at{" "}
					<span className="font-mono">
						https://{hostname || "doce"}.your-tailnet.ts.net
					</span>
				</p>
			</div>
			<Button
				onClick={handleConnect}
				disabled={isConnecting || !authKey.trim()}
			>
				{isConnecting ? (
					<>
						<Loader2 className="mr-2 size-4 animate-spin" />
						Connecting...
					</>
				) : (
					"Connect"
				)}
			</Button>
		</div>
	);
}

export function TailscaleSettings() {
	const [data, setData] = useState<TailscaleStatusData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isDisconnecting, setIsDisconnecting] = useState(false);

	const fetchStatus = useCallback(async () => {
		try {
			const result = await actions.tailscale.getStatus({});

			if (result.error) {
				toast.error("Failed to fetch Tailscale status");
				return;
			}

			setData(result.data as TailscaleStatusData);
		} catch {
			// Tailscale actions might not exist yet
			setData({ installed: false, config: null, status: null });
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStatus();
	}, [fetchStatus]);

	const handleDisconnect = async () => {
		setIsDisconnecting(true);
		try {
			const result = await actions.tailscale.disconnect({});

			if (result.error) {
				toast.error(result.error.message || "Failed to disconnect");
				return;
			}

			toast.success("Disconnected from Tailscale");
			fetchStatus();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to disconnect";
			toast.error(message);
		} finally {
			setIsDisconnecting(false);
		}
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Tailscale</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-2 text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						Loading...
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!data?.installed) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Tailscale</CardTitle>
					<CardDescription>
						Tailscale is not installed. Deploy doce with the latest Docker image
						to enable secure HTTPS access via your tailnet.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	const isConnected = data.config?.enabled && data.status?.connected;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Tailscale</CardTitle>
						<CardDescription>
							Connect to your tailnet for secure HTTPS access. The main app and
							each project will get their own{" "}
							<span className="font-mono text-xs">.ts.net</span> hostname.
						</CardDescription>
					</div>
					<StatusBadge connected={!!isConnected} />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{isConnected && data.status ? (
					<>
						<ConnectionInfo status={data.status} />
						<Button
							variant="destructive"
							onClick={handleDisconnect}
							disabled={isDisconnecting}
						>
							{isDisconnecting ? (
								<>
									<Loader2 className="mr-2 size-4 animate-spin" />
									Disconnecting...
								</>
							) : (
								<>
									<Unplug className="mr-2 size-4" />
									Disconnect
								</>
							)}
						</Button>
					</>
				) : (
					<ConnectForm onConnected={fetchStatus} />
				)}
			</CardContent>
		</Card>
	);
}
