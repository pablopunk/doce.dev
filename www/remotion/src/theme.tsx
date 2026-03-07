import type React from "react";
import { createContext, useContext } from "react";

export type ThemeMode = "dark" | "light";

export type Theme = {
	mode: ThemeMode;

	wallpaperGradient: string;
	wallpaperGlow1: string;
	wallpaperGlow2: string;

	windowTitleBar: string;
	windowTitleText: string;
	windowBorder: string;
	windowShadow: string;
	windowTitleBorderBottom: string;

	sceneBg: string;
	navbarBg: string;
	chatPanelBg: string;
	rightPanelBg: string;
	cardBg: string;
	inputBg: string;
	codeBg: string;
	codeTabBg: string;
	codeTabBorder: string;

	iphoneBody: string;
	iphoneBorder: string;
	iphoneNotch: string;
	iphoneScreenBg: string;
	iphoneShadow: string;
	iphoneLiveBadgeBg: string;

	textPrimary: string;
	textSecondary: string;
	textMuted: string;
	textSubtle: string;
	chatUserText: string;
	chatAssistantText: string;
	chatUserLabel: string;
	chatAssistantLabel: string;

	borderSubtle: string;
	borderLight: string;
	borderMedium: string;
	inputBorderColor: string;

	divider: string;

	pillBg: string;
	pillBorder: string;
	pillText: string;

	tabsListBg: string;
	tabsTriggerActive: string;

	mutedBg50: string;

	fileHighlightBg: string;
	fileHighlightText: string;
	fileText: string;
	fileIcon: string;

	codeKeyword: string;
	codeString: string;
	codeTag: string;
	codeAttribute: string;
	codeComment: string;
	codeDefault: string;
	codeLineNumber: string;
	codeCursor: string;

	buttonBg: string;
	buttonBgPressed: string;
	buttonPrimary: string;
	buttonPrimaryForeground: string;

	chart1: string;
	chart4: string;
	chart5: string;

	blurredBg: string;
	blurredBorder: string;
	blurredPlaceholder: string;

	spinnerTrack: string;
	spinnerArc: string;

	assistantAvatarBg: string;

	statusSuccess: string;
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

	sceneBg: "#0f1117",
	navbarBg: "#0f1117",
	chatPanelBg: "#0f1117",
	rightPanelBg: "#0f1117",
	cardBg: "#1e2030",
	inputBg: "rgba(255,255,255,0.05)",
	codeBg: "#1e1e1e",
	codeTabBg: "#1e2030",
	codeTabBorder: "rgba(255,255,255,0.10)",

	iphoneBody: "#1c1c1e",
	iphoneBorder: "rgba(255,255,255,0.15)",
	iphoneNotch: "#000",
	iphoneScreenBg: "#0f1115",
	iphoneShadow:
		"0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
	iphoneLiveBadgeBg: "rgba(0,0,0,0.6)",

	textPrimary: "#f8f9fa",
	textSecondary: "#9ca3af",
	textMuted: "#8b93a5",
	textSubtle: "rgba(255,255,255,0.6)",
	chatUserText: "#f8f9fa",
	chatAssistantText: "#e5e7eb",
	chatUserLabel: "#9ca3af",
	chatAssistantLabel: "#8b93a5",

	borderSubtle: "rgba(255,255,255,0.10)",
	borderLight: "rgba(255,255,255,0.10)",
	borderMedium: "rgba(255,255,255,0.15)",
	inputBorderColor: "rgba(255,255,255,0.15)",

	divider: "rgba(255,255,255,0.10)",

	pillBg: "#2a2e3e",
	pillBorder: "rgba(255,255,255,0.10)",
	pillText: "#d1d5db",

	tabsListBg: "#2a2e3e",
	tabsTriggerActive: "#1e2030",

	mutedBg50: "rgba(42,46,62,0.5)",

	fileHighlightBg: "#1e3a5f",
	fileHighlightText: "#58a6ff",
	fileText: "#e6edf3",
	fileIcon: "#9ca3af",

	codeKeyword: "#ff7b72",
	codeString: "#a5d6ff",
	codeTag: "#7ee787",
	codeAttribute: "#d2a8ff",
	codeComment: "#8b949e",
	codeDefault: "#e6edf3",
	codeLineNumber: "#484f58",
	codeCursor: "#58a6ff",

	buttonBg: "#e8eaf0",
	buttonBgPressed: "#d1d5db",
	buttonPrimary: "#e8eaf0",
	buttonPrimaryForeground: "#1e2030",

	chart1: "#e97316",
	chart4: "#eab308",
	chart5: "#f59e0b",

	blurredBg: "rgba(255,255,255,0.03)",
	blurredBorder: "rgba(255,255,255,0.05)",
	blurredPlaceholder: "rgba(255,255,255,0.1)",

	spinnerTrack: "rgba(124,58,237,0.2)",
	spinnerArc: "#7c3aed",

	assistantAvatarBg: "#2a2e3e",

	statusSuccess: "#22c55e",
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
	cardBg: "#ffffff",
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
	textMuted: "#6b7280",
	textSubtle: "rgba(0,0,0,0.5)",
	chatUserText: "#111827",
	chatAssistantText: "#374151",
	chatUserLabel: "#374151",
	chatAssistantLabel: "#6b7280",

	borderSubtle: "#e5e7eb",
	borderLight: "#e5e7eb",
	borderMedium: "#d1d5db",
	inputBorderColor: "#e5e7eb",

	divider: "#e5e7eb",

	pillBg: "#f3f4f6",
	pillBorder: "#e5e7eb",
	pillText: "#374151",

	tabsListBg: "#f3f4f6",
	tabsTriggerActive: "#ffffff",

	mutedBg50: "rgba(243,244,246,0.5)",

	fileHighlightBg: "#dbeafe",
	fileHighlightText: "#2563eb",
	fileText: "#24292f",
	fileIcon: "#9ca3af",

	codeKeyword: "#cf222e",
	codeString: "#0a3069",
	codeTag: "#116329",
	codeAttribute: "#8250df",
	codeComment: "#6e7781",
	codeDefault: "#24292f",
	codeLineNumber: "#8b949e",
	codeCursor: "#2563eb",

	buttonBg: "#111827",
	buttonBgPressed: "#374151",
	buttonPrimary: "#111827",
	buttonPrimaryForeground: "#f8f9fa",

	chart1: "#e97316",
	chart4: "#eab308",
	chart5: "#f59e0b",

	blurredBg: "rgba(0,0,0,0.03)",
	blurredBorder: "rgba(0,0,0,0.05)",
	blurredPlaceholder: "rgba(0,0,0,0.08)",

	spinnerTrack: "rgba(124,58,237,0.15)",
	spinnerArc: "#7c3aed",

	assistantAvatarBg: "#f3f4f6",

	statusSuccess: "#22c55e",
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
