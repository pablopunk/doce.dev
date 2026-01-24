import { actions } from "astro:actions";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const result = await actions.auth.login({ username, password });

			if (result.error) {
				toast.error(result.error.message);
				setLoading(false);
				return;
			}

			toast.success("Login successful");
			// Redirect immediately - user will see toast during page load
			window.location.href = "/";
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Login failed");
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="username">Username</Label>
				<Input
					id="username"
					type="text"
					placeholder="Username"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					disabled={loading}
					required
					autoFocus
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					disabled={loading}
					required
				/>
			</div>

			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? "Signing in..." : "Login"}
			</Button>
		</form>
	);
}
