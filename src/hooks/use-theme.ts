"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

export function useTheme() {
	const [theme, setTheme] = useState<Theme>("system");
	const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

	useEffect(() => {
		// Load theme from localStorage
		const stored = localStorage.getItem("theme") as Theme | null;
		if (stored) {
			setTheme(stored);
		}

		// Function to apply theme
		const applyTheme = (currentTheme: Theme) => {
			const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			const effectiveTheme =
				currentTheme === "system"
					? mediaQuery.matches
						? "dark"
						: "light"
					: currentTheme;

			setResolvedTheme(effectiveTheme as "light" | "dark");

			// Apply theme class to html element
			document.documentElement.classList.remove("light", "dark");
			document.documentElement.classList.add(effectiveTheme);
		};

		// Apply initial theme
		applyTheme(stored || "system");

		// Listen for system theme changes
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleSystemThemeChange = () => {
			if (theme === "system") {
				applyTheme("system");
			}
		};

		mediaQuery.addEventListener("change", handleSystemThemeChange);
		return () =>
			mediaQuery.removeEventListener("change", handleSystemThemeChange);
	}, [theme]);

	const changeTheme = (newTheme: Theme) => {
		setTheme(newTheme);
		localStorage.setItem("theme", newTheme);

		// Apply immediately
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const effectiveTheme =
			newTheme === "system"
				? mediaQuery.matches
					? "dark"
					: "light"
				: newTheme;

		setResolvedTheme(effectiveTheme as "light" | "dark");

		document.documentElement.classList.remove("light", "dark");
		document.documentElement.classList.add(effectiveTheme);
	};

	return { theme, resolvedTheme, setTheme: changeTheme };
}
