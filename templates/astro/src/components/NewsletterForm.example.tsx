/**
 * Example: Using Astro Actions in React components
 * 
 * This file demonstrates how to:
 * 1. Import and call actions
 * 2. Handle loading states
 * 3. Display errors and success messages
 * 
 * To use:
 * 1. Uncomment the action in src/actions/index.ts
 * 2. Rename this file to remove .example
 * 3. Import in your page with client:load
 */

"use client";
import { useState } from "react";
// Uncomment when you have actions:
// import { actions } from "astro:actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function NewsletterForm() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setMessage(null);

		try {
			// Uncomment when you have the subscribe action:
			// const { data, error } = await actions.subscribe({ email });
			
			// if (error) {
			//   setMessage({ type: "error", text: error.message });
			//   return;
			// }

			// setMessage({ type: "success", text: data.message });
			// setEmail("");
			
			// For demo purposes:
			await new Promise(resolve => setTimeout(resolve, 1000));
			setMessage({ type: "success", text: "Thanks for subscribing!" });
			setEmail("");
		} catch (err) {
			setMessage({ type: "error", text: "Something went wrong" });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="w-full max-w-md space-y-4">
			<form onSubmit={handleSubmit} className="flex gap-2">
				<Input
					type="email"
					placeholder="Enter your email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					disabled={loading}
				/>
				<Button type="submit" disabled={loading}>
					{loading ? "..." : "Subscribe"}
				</Button>
			</form>

			{message && (
				<Alert variant={message.type === "error" ? "destructive" : "default"}>
					<AlertDescription>{message.text}</AlertDescription>
				</Alert>
			)}
		</div>
	);
}
