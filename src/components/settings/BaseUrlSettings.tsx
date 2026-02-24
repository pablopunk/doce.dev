import { actions } from "astro:actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setCachedBaseUrl, useBaseUrlSetting } from "@/hooks/useBaseUrlSetting";

export function BaseUrlSettings() {
	const { baseUrl, isLoading } = useBaseUrlSetting();
	const [draft, setDraft] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [currentHostBaseUrl, setCurrentHostBaseUrl] = useState<string | null>(
		null,
	);
	const [currentHostname, setCurrentHostname] = useState<string>("host");

	useEffect(() => {
		setCurrentHostBaseUrl(
			`${window.location.protocol}//${window.location.hostname}`,
		);
		setCurrentHostname(window.location.hostname);
	}, []);

	useEffect(() => {
		setDraft(baseUrl ?? "");
	}, [baseUrl]);

	const normalizedDraft = draft.trim();
	const normalizedSavedBaseUrl = (baseUrl ?? "").trim();
	const hasChanges = normalizedDraft !== normalizedSavedBaseUrl;

	const handleSave = async () => {
		setIsSaving(true);

		try {
			const result = await actions.settings.setBaseUrl({
				baseUrl: normalizedDraft || undefined,
			});

			if (result.error) {
				toast.error(result.error.message || "Failed to update Base URL");
				return;
			}

			setCachedBaseUrl(result.data?.baseUrl ?? null);
			toast.success("Base URL updated");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to update Base URL";
			toast.error(errorMessage);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Base URL</CardTitle>
				<CardDescription>
					Used for generated links in the UI. Leave empty to use the current
					browser origin as fallback.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="base-url">Base URL</Label>
					<Input
						id="base-url"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="https://doce.example.com"
						disabled={isLoading || isSaving}
					/>
				</div>

				<div className="flex items-center gap-2">
					<Button
						onClick={handleSave}
						disabled={isLoading || isSaving || !hasChanges}
					>
						{isSaving ? "Saving..." : "Save Base URL"}
					</Button>
					<Button
						variant="outline"
						onClick={() => {
							if (!currentHostBaseUrl) {
								return;
							}
							setDraft(currentHostBaseUrl);
						}}
						disabled={isLoading || isSaving || !currentHostBaseUrl}
					>
						{`Use ${currentHostname}`}
					</Button>
					<Button
						variant="outline"
						onClick={() => setDraft("")}
						disabled={isLoading || isSaving || draft.length === 0}
					>
						Clear
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
