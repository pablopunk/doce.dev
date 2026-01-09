import { actions } from "astro:actions";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupForm() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			const result = await actions.setup.createAdmin({
				username,
				password,
				confirmPassword,
			});

			if (result.error) {
				setError(result.error.message);
				setLoading(false);
				return;
			}

			toast.success("Admin account created successfully!");

			// Redirect to home after successful setup
			setTimeout(() => {
				window.location.href = "/";
			}, 1500);
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{error}
				</div>
			)}

			<div className="space-y-2">
				<Label htmlFor="username">Username</Label>
				<Input
					id="username"
					type="text"
					placeholder="admin"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					disabled={loading}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="Enter a secure password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					disabled={loading}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="confirmPassword">Confirm Password</Label>
				<Input
					id="confirmPassword"
					type="password"
					placeholder="Confirm your password"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					disabled={loading}
					required
				/>
			</div>

			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? "Creating Account..." : "Create Admin Account"}
			</Button>
		</form>
	);
}
