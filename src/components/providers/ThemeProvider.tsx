"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
	theme: Theme;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
};

interface ThemeProviderProps {
	children: React.ReactNode;
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
	const [theme, setTheme] = useState<Theme>("light");
	const [mounted, setMounted] = useState(false);

	// Initialize theme on mount
	useEffect(() => {
		// Check localStorage first
		const savedTheme = localStorage.getItem("doce-theme") as Theme | null;

		if (savedTheme) {
			setTheme(savedTheme);
			applyTheme(savedTheme);
		} else {
			// Check system preference
			const prefersDark = window.matchMedia(
				"(prefers-color-scheme: dark)",
			).matches;
			const systemTheme: Theme = prefersDark ? "dark" : "light";
			setTheme(systemTheme);
			applyTheme(systemTheme);
		}

		setMounted(true);
	}, []);

	// Listen to storage changes (cross-tab sync)
	useEffect(() => {
		if (!mounted) return;

		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === "doce-theme" && e.newValue) {
				const newTheme = e.newValue as Theme;
				setTheme(newTheme);
				applyTheme(newTheme);
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, [mounted]);

	const applyTheme = (newTheme: Theme) => {
		const htmlElement = document.documentElement;
		if (newTheme === "dark") {
			htmlElement.classList.add("dark");
		} else {
			htmlElement.classList.remove("dark");
		}
	};

	const toggleTheme = () => {
		const newTheme = theme === "light" ? "dark" : "light";
		setTheme(newTheme);
		localStorage.setItem("doce-theme", newTheme);
		applyTheme(newTheme);
	};

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
};

export default ThemeProvider;
