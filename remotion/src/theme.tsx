import type React from "react";
import { createContext, useContext } from "react";

export type ThemeMode = "dark" | "light";

export type Theme = {
	mode: ThemeMode;

	// Wallpaper (behind macOS window)
	wallpaperGradient: string;
	wallpaperGlow1: string;
	wallpaperGlow2: string;

	// MacOS window chrome
	windowTitleBar: string;
	windowTitleText: string;
	windowBorder: string;
	windowShadow: string;
	windowTitleBorderBottom: string;

	// Main scene backgrounds
	sceneBg: string;
	navbarBg: string;
	chatPanelBg: string;
	rightPanelBg: string;
	cardBg: string;
	inputBg: string;
	codeBg: string;
	codeTabBg: string;
	codeTabBorder: string;

	// iPhone
	iphoneBody: string;
	iphoneBorder: string;
	iphoneNotch: string;
	iphoneScreenBg: string;
	iphoneShadow: string;
	iphoneLiveBadgeBg: string;

	// Text
	textPrimary: string;
	textSecondary: string;
	textMuted: string;
	textSubtle: string;
	chatUserText: string;
	chatAssistantText: string;
	chatUserLabel: string;
	chatAssistantLabel: string;

	// Borders
	borderSubtle: string;
	borderLight: string;
	borderMedium: string;

	// Divider (between panels)
	divider: string;

	// Action pills
	pillBg: string;
	pillBorder: string;
	pillText: string;

	// File tree
	fileHighlightBg: string;
	fileHighlightText: string;
	fileText: string;
	fileIcon: string;

	// Code syntax (changes between themes)
	codeKeyword: string;
	codeString: string;
	codeTag: string;
	codeAttribute: string;
	codeComment: string;
	codeDefault: string;
	codeLineNumber: string;
	codeCursor: string;

	// Buttons
	buttonBg: string;
	buttonBgPressed: string;

	// Deploy scene blurred bg elements
	blurredBg: string;
	blurredBorder: string;
	blurredPlaceholder: string;

	// Spinner
	spinnerTrack: string;
	spinnerArc: string;

	// Avatar
	assistantAvatarBg: string;
};

const dark: Theme = {
	mode: "dark",

	wallpaperGradient:
		"radial-gradient(ellipse at 30% 20%, #1a1040 0%, #0c0c1a 40%, #080812 100%)",
	wallpaperGlow1:
		"radial-gradient(circle, rgba(99,70,220,0.12) 0%, transparent 70%)",
	wallpaperGlow2:
		"radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",

	windowTitleBar: "linear-gradient(180deg, #2a2a35 0%, #1e1e28 100%)",
	windowTitleText: "rgba(255,255,255,0.35)",
	windowBorder: "rgba(255,255,255,0.1)",
	windowShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
	windowTitleBorderBottom: "rgba(255,255,255,0.06)",

	sceneBg: "#0a0a12",
	navbarBg: "#0d0d18",
	chatPanelBg: "#0f1115",
	rightPanelBg: "#111318",
	cardBg: "#161b2e",
	inputBg: "#1a1d24",
	codeBg: "#0d1117",
	codeTabBg: "#161b22",
	codeTabBorder: "#21262d",

	iphoneBody: "#1c1c1e",
	iphoneBorder: "rgba(255,255,255,0.15)",
	iphoneNotch: "#000",
	iphoneScreenBg: "#0f1115",
	iphoneShadow:
		"0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
	iphoneLiveBadgeBg: "rgba(0,0,0,0.6)",

	textPrimary: "#ffffff",
	textSecondary: "#9ca3af",
	textMuted: "#6b7280",
	textSubtle: "rgba(255,255,255,0.6)",
	chatUserText: "#ffffff",
	chatAssistantText: "#d1d5db",
	chatUserLabel: "#d1d5db",
	chatAssistantLabel: "#9ca3af",

	borderSubtle: "rgba(255,255,255,0.06)",
	borderLight: "rgba(255,255,255,0.08)",
	borderMedium: "rgba(255,255,255,0.1)",

	divider: "rgba(255,255,255,0.06)",

	pillBg: "#1e2438",
	pillBorder: "rgba(255,255,255,0.08)",
	pillText: "#d1d5db",

	fileHighlightBg: "#1e3a5f",
	fileHighlightText: "#58a6ff",
	fileText: "#e6edf3",
	fileIcon: "#8b949e",

	codeKeyword: "#ff7b72",
	codeString: "#a5d6ff",
	codeTag: "#7ee787",
	codeAttribute: "#d2a8ff",
	codeComment: "#8b949e",
	codeDefault: "#e6edf3",
	codeLineNumber: "#484f58",
	codeCursor: "#58a6ff",

	buttonBg: "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)",
	buttonBgPressed: "linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)",

	blurredBg: "rgba(255,255,255,0.03)",
	blurredBorder: "rgba(255,255,255,0.05)",
	blurredPlaceholder: "rgba(255,255,255,0.1)",

	spinnerTrack: "rgba(124,58,237,0.2)",
	spinnerArc: "#7c3aed",

	assistantAvatarBg: "#1e2438",
};

const light: Theme = {
	mode: "light",

	wallpaperGradient:
		"radial-gradient(ellipse at 30% 20%, #e8e0ff 0%, #f0f0f5 40%, #f5f5f7 100%)",
	wallpaperGlow1:
		"radial-gradient(circle, rgba(99,70,220,0.08) 0%, transparent 70%)",
	wallpaperGlow2:
		"radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",

	windowTitleBar: "linear-gradient(180deg, #f0f0f0 0%, #e0e0e0 100%)",
	windowTitleText: "rgba(0,0,0,0.45)",
	windowBorder: "rgba(0,0,0,0.15)",
	windowShadow: "0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)",
	windowTitleBorderBottom: "rgba(0,0,0,0.08)",

	sceneBg: "#ffffff",
	navbarBg: "#fafafa",
	chatPanelBg: "#f9fafb",
	rightPanelBg: "#ffffff",
	cardBg: "#f3f4f6",
	inputBg: "#f3f4f6",
	codeBg: "#ffffff",
	codeTabBg: "#f3f4f6",
	codeTabBorder: "#e5e7eb",

	iphoneBody: "#f5f5f7",
	iphoneBorder: "rgba(0,0,0,0.15)",
	iphoneNotch: "#1a1a1a",
	iphoneScreenBg: "#ffffff",
	iphoneShadow:
		"0 50px 100px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05) inset",
	iphoneLiveBadgeBg: "rgba(0,0,0,0.7)",

	textPrimary: "#111827",
	textSecondary: "#6b7280",
	textMuted: "#9ca3af",
	textSubtle: "rgba(0,0,0,0.5)",
	chatUserText: "#111827",
	chatAssistantText: "#374151",
	chatUserLabel: "#374151",
	chatAssistantLabel: "#6b7280",

	borderSubtle: "rgba(0,0,0,0.06)",
	borderLight: "rgba(0,0,0,0.08)",
	borderMedium: "rgba(0,0,0,0.12)",

	divider: "rgba(0,0,0,0.08)",

	pillBg: "#e5e7eb",
	pillBorder: "rgba(0,0,0,0.08)",
	pillText: "#374151",

	fileHighlightBg: "#dbeafe",
	fileHighlightText: "#2563eb",
	fileText: "#24292f",
	fileIcon: "#6e7781",

	codeKeyword: "#cf222e",
	codeString: "#0a3069",
	codeTag: "#116329",
	codeAttribute: "#8250df",
	codeComment: "#6e7781",
	codeDefault: "#24292f",
	codeLineNumber: "#8b949e",
	codeCursor: "#2563eb",

	buttonBg: "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)",
	buttonBgPressed: "linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)",

	blurredBg: "rgba(0,0,0,0.03)",
	blurredBorder: "rgba(0,0,0,0.05)",
	blurredPlaceholder: "rgba(0,0,0,0.08)",

	spinnerTrack: "rgba(124,58,237,0.15)",
	spinnerArc: "#7c3aed",

	assistantAvatarBg: "#e5e7eb",
};

export const themes = { dark, light } as const;

const ThemeContext = createContext<Theme>(dark);

export const ThemeProvider: React.FC<{
	mode: ThemeMode;
	children: React.ReactNode;
}> = ({ mode, children }) => (
	<ThemeContext.Provider value={themes[mode]}>{children}</ThemeContext.Provider>
);

export const useTheme = (): Theme => useContext(ThemeContext);
