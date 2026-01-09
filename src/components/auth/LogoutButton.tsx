import { actions } from "astro:actions";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
	const [loading, setLoading] = useState(false);

	const handleLogout = async () => {
		setLoading(true);

		try {
			const result = await actions.auth.logout();

			if (result.error) {
				toast.error(result.error.message);
				setLoading(false);
				return;
			}

			toast.success("Logged out");
			// Redirect immediately to login page
			window.location.href = "/login";
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Logout failed");
			setLoading(false);
		}
	};

	return (
		<Button onClick={handleLogout} disabled={loading} variant="outline">
			{loading ? "Logging out..." : "Logout"}
		</Button>
	);
}
