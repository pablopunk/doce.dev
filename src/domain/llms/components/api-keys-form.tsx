"use client";

import { actions } from "astro:actions";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProviderConfig {
	id: string;
	name: string;
	icon: React.ReactNode;
	placeholder: string;
}

const PROVIDERS: ProviderConfig[] = [
	{
		id: "openrouter",
		name: "OpenRouter",
		icon: (
			<div className="h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold">
				OR
			</div>
		),
		placeholder: "sk-or-v1-...",
	},
];

export function ApiKeysForm() {
	const [keys, setKeys] = useState<Record<string, string>>({});
	const [hasKeys, setHasKeys] = useState<Record<string, boolean>>({});
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState<string | null>(null);
	const [saveStatus, setSaveStatus] = useState<{
		provider: string;
		message: string;
		type: "success" | "error";
	} | null>(null);

	useEffect(() => {
		loadKeys();
	}, []);

	const loadKeys = async () => {
		try {
			const { data, error } = await actions.config.getApiKeys();
			if (!error && data) {
				setHasKeys(data.keys);
			}
		} catch (err) {
			console.error("Failed to load API keys:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleSave = async (provider: string) => {
		setSaving(provider);
		setSaveStatus(null);

		try {
			const { error } = await actions.config.setApiKey({
				provider: provider as any,
				apiKey: keys[provider] || "",
			});

			if (!error) {
				setHasKeys((prev) => ({
					...prev,
					[provider]: Boolean(keys[provider]),
				}));
				setSaveStatus({ provider, message: "Saved!", type: "success" });
				setTimeout(() => setSaveStatus(null), 2000);
			} else {
				throw new Error("Failed to save");
			}
		} catch (err) {
			setSaveStatus({ provider, message: "Failed to save", type: "error" });
			setTimeout(() => setSaveStatus(null), 2000);
		} finally {
			setSaving(null);
		}
	};

	const toggleShow = (provider: string) => {
		setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<div className="h-6 w-6 animate-spin rounded-full border-2 border-strong border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{PROVIDERS.map((provider) => (
				<div key={provider.id} className="space-y-2">
					<Label
						htmlFor={provider.id}
						className="flex items-center gap-2 font-bold"
					>
						{provider.icon}
						<span>{provider.name}</span>
						{hasKeys[provider.id] && (
							<span className="text-xs text-strong text-strong">
								(configured)
							</span>
						)}
					</Label>
					<div className="flex gap-2 items-center">
						<div className="relative flex-1">
							<Input
								id={provider.id}
								type={showKeys[provider.id] ? "text" : "password"}
								placeholder={provider.placeholder}
								value={keys[provider.id] || ""}
								onChange={(e) =>
									setKeys((prev) => ({
										...prev,
										[provider.id]: e.target.value,
									}))
								}
								className="pr-10"
							/>
							<button
								type="button"
								onClick={() => toggleShow(provider.id)}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-strong"
							>
								{showKeys[provider.id] ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</button>
						</div>
						<Button
							onClick={() => handleSave(provider.id)}
							disabled={saving === provider.id}
						>
							{saving === provider.id ? "Saving..." : "Save"}
						</Button>
					</div>
					{saveStatus?.provider === provider.id && (
						<p
							className={`text-sm ${
								saveStatus.type === "success"
									? "text-strong text-strong"
									: "text-danger"
							}`}
						>
							{saveStatus.message}
						</p>
					)}
				</div>
			))}
			<p className="text-xs text-muted">
				Note: OpenRouter supports 400+ models from all providers. You only need
				one API key.
			</p>
		</div>
	);
}
