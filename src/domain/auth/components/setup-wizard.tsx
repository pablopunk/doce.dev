"use client";

import { actions } from "astro:actions";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

export default function SetupWizard() {
	const [step, setStep] = useState(1);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const [aiProvider, setAiProvider] = useState<"openrouter">("openrouter");
	const [openrouterKey, setOpenrouterKey] = useState("");

	const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		setLoading(true);

		try {
			const { error } = await actions.setup.createUser({ username, password });

			if (error) {
				// If setup is already completed, redirect to dashboard
				if (error.message?.includes("already completed")) {
					window.location.href = "/dashboard";
					return;
				}
				throw new Error(error.message || "Failed to create user");
			}

			setStep(2);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create user");
		} finally {
			setLoading(false);
		}
	};

	const handleConfigureAI = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");

		const apiKey = openrouterKey;

		if (!apiKey) {
			setError("Please enter an API key");
			return;
		}

		setLoading(true);

		try {
			const { error } = await actions.setup.setupAI({
				provider: aiProvider,
				apiKey,
			});

			if (error) {
				throw new Error(error.message || "Failed to configure AI");
			}

			setStep(3);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to configure AI");
		} finally {
			setLoading(false);
		}
	};

	const handleComplete = async () => {
		setLoading(true);

		try {
			const { error } = await actions.setup.completeSetup();

			if (error) {
				throw new Error("Failed to complete setup");
			}

			if (typeof window !== "undefined") {
				window.location.assign("/dashboard");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to complete setup");
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-2xl">
				<CardHeader className="text-center">
					<div className="mb-4 flex justify-center">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-strong/10">
							<Sparkles className="h-6 w-6 text-strong" />
						</div>
					</div>
					<CardTitle className="text-3xl">Welcome to doce.dev</CardTitle>
					<CardDescription>
						Let's get your self-hosted AI website builder set up
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-6">
					<div className="flex items-center justify-center gap-2 my-5">
						<div
							className={`h-2 w-2 rounded-full ${step >= 1 ? "bg-strong" : "bg-raised"}`}
						/>
						<div
							className={`h-0.5 w-12 ${step >= 2 ? "bg-strong" : "bg-raised"}`}
						/>
						<div
							className={`h-2 w-2 rounded-full ${step >= 2 ? "bg-strong" : "bg-raised"}`}
						/>
						<div
							className={`h-0.5 w-12 ${step >= 3 ? "bg-strong" : "bg-raised"}`}
						/>
						<div
							className={`h-2 w-2 rounded-full ${step >= 3 ? "bg-strong" : "bg-raised"}`}
						/>
					</div>

					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{step === 1 && (
						<form onSubmit={handleCreateUser} className="space-y-4">
							<div className="space-y-2">
								<h3 className="text-lg font-semibold">Create Admin Account</h3>
								<p className="text-sm text-muted">
									This will be your login to access the builder
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="username">Username</Label>
								<Input
									id="username"
									value={username}
									onChange={(event) => setUsername(event.target.value)}
									placeholder="admin"
									required
									autoFocus
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									placeholder="••••••••"
									required
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="confirmPassword">Confirm Password</Label>
								<Input
									id="confirmPassword"
									type="password"
									value={confirmPassword}
									onChange={(event) => setConfirmPassword(event.target.value)}
									placeholder="••••••••"
									required
								/>
							</div>

							<Button type="submit" className="w-full" disabled={loading}>
								{loading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Creating...
									</>
								) : (
									"Continue"
								)}
							</Button>
						</form>
					)}

					{step === 2 && (
						<form onSubmit={handleConfigureAI} className="space-y-4">
							<div className="space-y-2">
								<h3 className="text-lg font-semibold">Configure AI Provider</h3>
								<p className="text-sm text-muted">
									Enter your OpenRouter API key to access 400+ AI models
								</p>
							</div>

							<div className="space-y-2">
								<Label htmlFor="openrouterKey">OpenRouter API Key</Label>
								<Input
									id="openrouterKey"
									type="password"
									value={openrouterKey}
									onChange={(event) => setOpenrouterKey(event.target.value)}
									placeholder="sk-or-v1-..."
									required
									autoFocus
								/>
								<p className="text-xs text-muted">
									Get your API key from{" "}
									<a
										href="https://openrouter.ai/keys"
										target="_blank"
										rel="noopener noreferrer"
										className="underline"
									>
										openrouter.ai/keys
									</a>
								</p>
							</div>

							<Button type="submit" className="w-full" disabled={loading}>
								{loading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Configuring...
									</>
								) : (
									"Continue"
								)}
							</Button>
						</form>
					)}

					{step === 3 && (
						<div className="space-y-6 text-center">
							<div className="flex justify-center">
								<div className="flex h-16 w-16 items-center justify-center rounded-full bg-strong/10">
									<CheckCircle2 className="h-8 w-8 text-strong" />
								</div>
							</div>

							<div className="space-y-2">
								<h3 className="text-lg font-semibold">All Set!</h3>
								<p className="text-sm text-muted">
									Your doce.dev is ready to use. You can now start creating
									amazing websites with AI.
								</p>
							</div>

							<div className="space-y-2 rounded-lg bg-surface p-4 text-left">
								<p className="text-sm font-medium">What's next?</p>
								<ul className="list-inside list-disc space-y-1 text-sm text-muted">
									<li>Create your first project</li>
									<li>Chat with AI to generate code</li>
									<li>Preview your site instantly</li>
									<li>Deploy with one click</li>
								</ul>
							</div>

							<Button
								onClick={handleComplete}
								className="w-full"
								disabled={loading}
							>
								{loading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Finalizing...
									</>
								) : (
									"Go to Dashboard"
								)}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
