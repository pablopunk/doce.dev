import { actions } from "astro:actions";
import { Check, ChevronsUpDown, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ProviderMethod {
	type: "api" | "oauth";
	label: string;
}

interface Provider {
	id: string;
	name: string;
	env: string[];
	connected: boolean;
	methods: ProviderMethod[];
}

interface PendingOauthState {
	providerId: string;
	providerName: string;
	methodIndex: number;
	url: string;
	instructions: string;
	mode: "auto" | "code";
}

function getDefaultMethodIndex(provider: Provider | undefined): number {
	if (!provider) return 0;
	const oauthIndex = provider.methods.findIndex(
		(method) => method.type === "oauth",
	);
	return oauthIndex >= 0 ? oauthIndex : 0;
}

export function ProvidersSettings() {
	const [providers, setProviders] = useState<Provider[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isConnecting, setIsConnecting] = useState(false);
	const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
	const [selectedMethodIndex, setSelectedMethodIndex] = useState(0);
	const [apiKey, setApiKey] = useState("");
	const [oauthCode, setOauthCode] = useState("");
	const [pendingOauth, setPendingOauth] = useState<PendingOauthState | null>(
		null,
	);
	const [isWaitingForOauth, setIsWaitingForOauth] = useState(false);
	const [open, setOpen] = useState(false);

	async function reloadProviders() {
		const result = await actions.providers.list();
		setProviders(result.data?.providers ?? []);
	}

	useEffect(() => {
		let mounted = true;

		async function loadProviders() {
			setIsLoading(true);
			try {
				const result = await actions.providers.list();
				if (mounted) {
					setProviders(result.data?.providers ?? []);
				}
			} catch {
				toast.error("Failed to load providers");
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		}

		loadProviders();

		return () => {
			mounted = false;
		};
	}, []);

	const availableProviders = useMemo(
		() => providers.filter((provider) => !provider.connected),
		[providers],
	);

	const selectedProviderConfig = availableProviders.find(
		(provider) => provider.id === selectedProvider,
	);
	const selectedMethod = selectedProviderConfig?.methods[selectedMethodIndex];

	function resetConnectionState() {
		setApiKey("");
		setOauthCode("");
		setPendingOauth(null);
		setIsWaitingForOauth(false);
	}

	function handleProviderSelection(providerId: string | null) {
		setSelectedProvider(providerId);
		const provider = availableProviders.find((item) => item.id === providerId);
		setSelectedMethodIndex(getDefaultMethodIndex(provider));
		resetConnectionState();
	}

	async function completePendingOauth(
		oauthState: PendingOauthState,
		code?: string,
	) {
		setIsWaitingForOauth(true);
		try {
			const { error } = await actions.providers.finishOauth({
				providerId: oauthState.providerId,
				methodIndex: oauthState.methodIndex,
				...(code ? { code } : {}),
			});

			if (error) {
				toast.error(error.message || "OAuth authorization failed");
				return false;
			}

			toast.success(`Connected to ${oauthState.providerName}`);
			handleProviderSelection(null);
			await reloadProviders();
			return true;
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "OAuth authorization failed";
			toast.error(errorMessage);
			return false;
		} finally {
			setIsWaitingForOauth(false);
		}
	}

	async function handleConnect() {
		if (!selectedProviderConfig || !selectedMethod) {
			return;
		}

		setIsConnecting(true);
		try {
			if (selectedMethod.type === "api") {
				if (!apiKey.trim()) {
					toast.error("API key is required");
					return;
				}

				const { error } = await actions.providers.connect({
					providerId: selectedProviderConfig.id,
					apiKey: apiKey.trim(),
				});

				if (error) {
					toast.error(error.message || "Failed to connect provider");
					return;
				}

				toast.success(`Connected to ${selectedProviderConfig.name}`);
				handleProviderSelection(null);
				await reloadProviders();
				return;
			}

			const result = await actions.providers.startOauth({
				providerId: selectedProviderConfig.id,
				methodIndex: selectedMethodIndex,
			});

			const authorization = result.data?.authorization;
			if (!authorization) {
				toast.error("Failed to start OAuth authorization");
				return;
			}

			window.open(authorization.url, "_blank", "noopener,noreferrer");
			const oauthState = {
				providerId: selectedProviderConfig.id,
				providerName: selectedProviderConfig.name,
				methodIndex: selectedMethodIndex,
				url: authorization.url,
				instructions: authorization.instructions,
				mode: authorization.method,
			};
			setPendingOauth(oauthState);
			toast.success(`Started ${selectedMethod.label}`);

			if (authorization.method === "auto") {
				void completePendingOauth(oauthState);
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to connect provider";
			toast.error(errorMessage);
		} finally {
			setIsConnecting(false);
		}
	}

	async function handleFinishOauth() {
		if (!pendingOauth) {
			return;
		}

		await completePendingOauth(
			pendingOauth,
			pendingOauth.mode === "code" ? oauthCode.trim() : undefined,
		);
	}

	async function handleDisconnect(providerId: string) {
		try {
			await actions.providers.disconnect({ providerId });
			toast.success(
				`Disconnected ${providers.find((provider) => provider.id === providerId)?.name || providerId}`,
			);
			await reloadProviders();
		} catch {
			toast.error("Failed to disconnect provider");
		}
	}

	if (isLoading) {
		return (
			<div className="space-y-6">
				<Card className="h-full">
					<CardHeader>
						<CardTitle>Providers</CardTitle>
						<CardDescription>
							Manage AI provider credentials. Credentials are stored in the
							central OpenCode runtime and shared across projects.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="animate-pulse">Loading providers...</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Providers</CardTitle>
				<CardDescription>
					Manage AI provider credentials. Credentials are stored in the central
					OpenCode runtime and shared across projects.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex h-full flex-col space-y-6">
				<div className="space-y-4">
					<div>
						<label
							htmlFor="provider-select"
							className="mb-2 block text-sm font-medium"
						>
							Select provider to connect
						</label>
						<Popover open={open} onOpenChange={setOpen}>
							<PopoverTrigger
								className={cn(
									"focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 inline-flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-border bg-background bg-clip-padding px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none group/button select-none hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground focus-visible:ring-[3px] aria-invalid:ring-[3px] disabled:pointer-events-none disabled:opacity-50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
								)}
								role="combobox"
								aria-expanded={open}
							>
								{selectedProvider
									? availableProviders.find(
											(provider) => provider.id === selectedProvider,
										)?.name
									: "Select provider..."}
								<ChevronsUpDown className="size-4 opacity-50" />
							</PopoverTrigger>
							<PopoverContent className="w-full p-0">
								<Command>
									<CommandInput placeholder="Search provider..." />
									<CommandList>
										<CommandEmpty>No provider found.</CommandEmpty>
										<CommandGroup>
											{availableProviders.map((provider) => (
												<CommandItem
													key={provider.id}
													value={provider.id}
													onSelect={(currentValue) => {
														handleProviderSelection(
															currentValue === selectedProvider
																? null
																: currentValue,
														);
														setOpen(false);
													}}
												>
													{provider.name}
													<Check
														className={cn(
															"ml-auto size-4",
															selectedProvider === provider.id
																? "opacity-100"
																: "opacity-0",
														)}
													/>
												</CommandItem>
											))}
										</CommandGroup>
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
					</div>

					{selectedProviderConfig && (
						<div className="space-y-4">
							<div className="space-y-2">
								<p className="text-sm font-medium">Connection method</p>
								<div className="grid gap-2">
									{selectedProviderConfig.methods.map((method, index) => (
										<button
											key={`${selectedProviderConfig.id}-${method.label}`}
											type="button"
											onClick={() => {
												setSelectedMethodIndex(index);
												resetConnectionState();
											}}
											className={cn(
												"rounded-lg border px-3 py-2 text-left text-sm transition-colors",
												selectedMethodIndex === index
													? "border-foreground bg-muted"
													: "border-border hover:bg-muted/60",
											)}
										>
											<div className="font-medium">{method.label}</div>
											<div className="text-muted-foreground text-xs uppercase">
												{method.type}
											</div>
										</button>
									))}
								</div>
							</div>

							{selectedMethod?.type === "api" && (
								<div>
									<label
										htmlFor="api-key"
										className="mb-2 block text-sm font-medium"
									>
										API Key
									</label>
									<Input
										id="api-key"
										type="password"
										value={apiKey}
										onChange={(event) => setApiKey(event.target.value)}
										placeholder="sk-..."
									/>
								</div>
							)}

							{pendingOauth &&
								pendingOauth.providerId === selectedProviderConfig.id && (
									<div className="space-y-3 rounded-lg border p-3">
										<p className="text-sm font-medium">
											Complete authorization
										</p>
										<p className="text-muted-foreground text-sm">
											{pendingOauth.instructions}
										</p>
										<a
											href={pendingOauth.url}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 text-sm underline"
										>
											Open authorization link
											<ExternalLink className="size-3" />
										</a>
										{pendingOauth.mode === "code" && (
											<Input
												id="oauth-code"
												value={oauthCode}
												onChange={(event) => setOauthCode(event.target.value)}
												placeholder="Paste the authorization code"
											/>
										)}
										<Button
											type="button"
											variant="secondary"
											onClick={handleFinishOauth}
											disabled={
												isWaitingForOauth ||
												(pendingOauth.mode === "code" && !oauthCode.trim())
											}
										>
											{isWaitingForOauth
												? "Waiting for OpenCode..."
												: pendingOauth.mode === "auto"
													? "Check again now"
													: "I finished authorization"}
										</Button>
									</div>
								)}
						</div>
					)}

					<Button
						onClick={handleConnect}
						disabled={
							isConnecting ||
							!selectedProviderConfig ||
							!selectedMethod ||
							(selectedMethod.type === "api" && !apiKey.trim())
						}
					>
						{isConnecting
							? "Connecting..."
							: selectedMethod?.type === "oauth"
								? "Start authorization"
								: "Connect"}
					</Button>
				</div>

				{providers.filter((provider) => provider.connected).length > 0 && (
					<div className="mt-auto">
						<h3 className="mb-3 text-lg font-semibold">Connected providers</h3>
						<div className="space-y-2">
							{providers
								.filter((provider) => provider.connected)
								.map((provider) => (
									<div
										key={provider.id}
										className="flex items-center justify-between rounded border p-3"
									>
										<div className="flex items-center gap-1">
											<span className="font-medium">{provider.name}</span>
											<span className="text-muted-foreground text-sm">
												({provider.id})
											</span>
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleDisconnect(provider.id)}
										>
											Disconnect
										</Button>
									</div>
								))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
