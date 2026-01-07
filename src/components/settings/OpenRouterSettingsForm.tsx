import { actions } from "astro:actions";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface Model {
	id: string;
	name: string;
	provider: string;
	tier: "top" | "fast";
	supportsImages: boolean;
}

interface OpenRouterSettingsFormProps {
	initialOpenrouterApiKey: string;
	initialDefaultModel: string;
	models: readonly Model[];
}

export function OpenRouterSettingsForm({
	initialOpenrouterApiKey,
	initialDefaultModel,
	models,
}: OpenRouterSettingsFormProps) {
	const [openrouterApiKey, setOpenrouterApiKey] = useState(
		initialOpenrouterApiKey,
	);
	const [defaultModel, setDefaultModel] = useState(initialDefaultModel);
	const [isSaving, setIsSaving] = useState(false);

	const handleSave = async () => {
		setIsSaving(true);

		try {
			const result = await actions.settings.save({
				openrouterApiKey,
				defaultModel,
			});

			if (result.error) {
				toast.error(result.error.message);
			} else {
				toast.success("Settings saved");
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to save settings",
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="openrouterApiKey">OpenRouter API Key</Label>
				<Input
					id="openrouterApiKey"
					type="password"
					placeholder="sk-or-..."
					value={openrouterApiKey}
					onChange={(e) => setOpenrouterApiKey(e.target.value)}
				/>
				<p className="text-xs text-muted-foreground">
					Get your API key from{" "}
					<a
						href="https://openrouter.ai/keys"
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary underline"
					>
						openrouter.ai/keys
					</a>
				</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor="defaultModel">Default Model</Label>
				<select
					id="defaultModel"
					value={defaultModel}
					onChange={(e) => setDefaultModel(e.target.value)}
					className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					{models.map((model) => (
						<option key={model.id} value={model.id}>
							{model.name} ({model.provider}) -{" "}
							{model.tier === "top" ? "Top Tier" : "Fast"}
						</option>
					))}
				</select>
			</div>

			<Button onClick={handleSave} disabled={isSaving}>
				{isSaving ? "Saving..." : "Save Settings"}
			</Button>
		</div>
	);
}
