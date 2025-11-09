"use client";

import { type CSSProperties, useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const getSystemTheme = (): ToasterProps["theme"] => {
	if (typeof window === "undefined") {
		return "system";
	}

	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
};

const Toaster = ({ ...props }: ToasterProps) => {
	const [theme, setTheme] = useState<ToasterProps["theme"]>(() =>
		getSystemTheme(),
	);

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => setTheme(media.matches ? "dark" : "light");

		handler();
		media.addEventListener("change", handler);
		return () => media.removeEventListener("change", handler);
	}, []);

	return (
		<Sonner
			theme={theme}
			className="toaster group"
			style={
				{
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
				} as CSSProperties
			}
			{...props}
		/>
	);
};

export { Toaster };
