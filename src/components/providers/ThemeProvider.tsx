"use client";

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type ResolvedTheme = "light" | "dark";
type ThemePreference = "light" | "dark" | "system";

interface ThemeContextType {
	theme: ResolvedTheme;
	preference: ThemePreference;
	setPreference: (pref: ThemePreference) => void;
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

function getSystemTheme(): ResolvedTheme {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
	return preference === "system" ? getSystemTheme() : preference;
}

interface ThemeProviderProps {
	children: React.ReactNode;
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
	const [preference, setPreferenceState] = useState<ThemePreference>("system");
	const [theme, setTheme] = useState<ResolvedTheme>("light");
	const [mounted, setMounted] = useState(false);

	const applyTheme = useCallback((resolved: ResolvedTheme) => {
		if (typeof document === "undefined") return;
		const htmlElement = document.documentElement;
		if (resolved === "dark") {
			htmlElement.classList.add("dark");
		} else {
			htmlElement.classList.remove("dark");
		}
	}, []);

	// Initialize theme on mount
	useEffect(() => {
		const saved = localStorage.getItem("doce-theme") as ThemePreference | null;
		const pref = saved ?? "system";
		const resolved = resolveTheme(pref);

		setPreferenceState(pref);
		setTheme(resolved);
		applyTheme(resolved);
		setMounted(true);
	}, [applyTheme]);

	// Listen for OS theme changes when preference is "system"
	useEffect(() => {
		if (!mounted || preference !== "system") return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			const resolved = getSystemTheme();
			setTheme(resolved);
			applyTheme(resolved);
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [mounted, preference, applyTheme]);

	// Listen to storage changes (cross-tab sync)
	useEffect(() => {
		if (!mounted) return;

		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === "doce-theme" && e.newValue) {
				const pref = e.newValue as ThemePreference;
				const resolved = resolveTheme(pref);
				setPreferenceState(pref);
				setTheme(resolved);
				applyTheme(resolved);
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, [mounted, applyTheme]);

	const setPreference = useCallback(
		(pref: ThemePreference) => {
			const resolved = resolveTheme(pref);
			setPreferenceState(pref);
			setTheme(resolved);
			localStorage.setItem("doce-theme", pref);
			applyTheme(resolved);
		},
		[applyTheme],
	);

	const toggleTheme = useCallback(() => {
		const next: ThemePreference = theme === "light" ? "dark" : "light";
		setPreference(next);
	}, [theme, setPreference]);

	return (
		<ThemeContext.Provider
			value={{ theme, preference, setPreference, toggleTheme }}
		>
			{children}
		</ThemeContext.Provider>
	);
};

export default ThemeProvider;
