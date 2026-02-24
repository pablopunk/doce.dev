import { actions } from "astro:actions";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
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

interface Provider {
	id: string;
	name: string;
	env: string[];
	connected: boolean;
}

export function ProvidersSettings() {
	const [providers, setProviders] = useState<Provider[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isConnecting, setIsConnecting] = useState(false);
	const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
	const [apiKey, setApiKey] = useState("");
	const [open, setOpen] = useState(false);

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

	async function handleConnect() {
		if (!selectedProvider || !apiKey.trim()) return;

		setIsConnecting(true);
		try {
			const { error } = await actions.providers.connect({
				providerId: selectedProvider,
				apiKey: apiKey.trim(),
			});

			if (error) {
				toast.error(error.message || "Failed to connect provider");
				return;
			}

			toast.success(
				`Connected to ${providers.find((p) => p.id === selectedProvider)?.name || selectedProvider}`,
			);
			setApiKey("");
			setSelectedProvider(null);

			const result = await actions.providers.list();
			setProviders(result.data?.providers ?? []);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to connect provider";
			toast.error(errorMessage);
		} finally {
			setIsConnecting(false);
		}
	}

	async function handleDisconnect(providerId: string) {
		try {
			await actions.providers.disconnect({ providerId });
			toast.success(
				`Disconnected ${providers.find((p) => p.id === providerId)?.name || providerId}`,
			);
			const result = await actions.providers.list();
			setProviders(result.data?.providers ?? []);
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
							Manage AI provider credentials. Credentials are stored in a global
							volume and shared with all project OpenCode containers.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="animate-pulse">Loading providers...</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	const availableProviders = providers.filter((p) => !p.connected);

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>Providers</CardTitle>
				<CardDescription>
					Manage AI provider credentials. Credentials are stored in a global
					volume and shared with all project OpenCode containers.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex h-full flex-col space-y-6">
				<div className="space-y-4">
					<div>
						<label
							htmlFor="provider-select"
							className="block text-sm font-medium mb-2"
						>
							Select provider to connect
						</label>
						<Popover open={open} onOpenChange={setOpen}>
							<PopoverTrigger
								className={cn(
									"focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 aria-expanded:bg-muted aria-expanded:text-foreground bg-clip-padding text-sm font-medium focus-visible:ring-[3px] aria-invalid:ring-[3px] [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-between w-full whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none h-8 gap-1.5 px-2.5",
								)}
								role="combobox"
								aria-expanded={open}
							>
								{selectedProvider
									? availableProviders.find((p) => p.id === selectedProvider)
											?.name
									: "Select provider..."}
								<ChevronsUpDown className="opacity-50 size-4" />
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
														setSelectedProvider(
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
					{selectedProvider && (
						<div>
							<label
								htmlFor="api-key"
								className="block text-sm font-medium mb-2"
							>
								API Key
							</label>
							<Input
								id="api-key"
								type="password"
								value={apiKey}
								onChange={(e) => setApiKey(e.target.value)}
								placeholder="sk-..."
							/>
						</div>
					)}
					<Button
						onClick={handleConnect}
						disabled={isConnecting || !selectedProvider || !apiKey.trim()}
					>
						{isConnecting ? "Connecting..." : "Connect"}
					</Button>
				</div>

				{providers.filter((p) => p.connected).length > 0 && (
					<div className="mt-auto">
						<h3 className="text-lg font-semibold mb-3">Connected providers</h3>
						<div className="space-y-2">
							{providers
								.filter((p) => p.connected)
								.map((p) => (
									<div
										key={p.id}
										className="flex items-center justify-between p-3 border rounded"
									>
										<div className="flex items-center gap-1">
											<span className="font-medium">{p.name}</span>
											<span className="text-sm text-muted-foreground">
												({p.id})
											</span>
										</div>
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleDisconnect(p.id)}
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
