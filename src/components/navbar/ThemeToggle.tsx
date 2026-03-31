"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui/button";

const cycleOrder = ["system", "light", "dark"] as const;

export const ThemeToggle = () => {
	const { theme, preference, setPreference } = useTheme();

	const cycleTheme = () => {
		const currentIndex = cycleOrder.indexOf(preference);
		const next = cycleOrder[(currentIndex + 1) % cycleOrder.length] ?? "system";
		setPreference(next);
	};

	const label =
		preference === "system"
			? "Using system theme"
			: `Switch from ${preference} mode`;

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={cycleTheme}
			aria-label={label}
			title={label}
		>
			{preference === "system" ? (
				<Monitor className="h-5 w-5" />
			) : theme === "light" ? (
				<Sun className="h-5 w-5" />
			) : (
				<Moon className="h-5 w-5" />
			)}
		</Button>
	);
};
