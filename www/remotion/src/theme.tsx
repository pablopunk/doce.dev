import type React from "react";
import { createContext, useContext } from "react";

export type ThemeMode = "dark" | "light";

export type Theme = {
	mode: ThemeMode;

	// Wallpaper / window chrome (used in macOS frame, if any)
	wallpaperGradient: string;
	wallpaperGlow1: string;
	wallpaperGlow2: string;
	windowTitleBar: string;
	windowTitleText: string;
	windowBorder: string;
	windowShadow: string;
	windowTitleBorderBottom: string;

	// Surfaces (mapped to globals.css tokens)
	sceneBg: string; // --background
	navbarBg: string; // --background
	chatPanelBg: string; // --background
	rightPanelBg: string; // --background
	cardBg: string; // --card
	popoverBg: string; // --popover
	inputBg: string; // --input bg-ish
	codeBg: string; // editor surface
	codeTabBg: string;
	codeTabBorder: string;

	// iPhone mock surfaces
	iphoneBody: string;
	iphoneBorder: string;
	iphoneNotch: string;
	iphoneScreenBg: string;
	iphoneShadow: string;
	iphoneLiveBadgeBg: string;

	// Text (mapped to globals.css tokens)
	textPrimary: string; // --foreground
	textSecondary: string; // --muted-foreground (slightly darker)
	textMuted: string; // --muted-foreground
	textSubtle: string;
	chatUserText: string;
	chatAssistantText: string;
	chatUserLabel: string;
	chatAssistantLabel: string;

	// Borders
	borderSubtle: string; // --border
	borderLight: string;
	borderMedium: string;
	inputBorderColor: string; // --input

	divider: string;

	// Pills / muted chips
	pillBg: string; // --secondary
	pillBorder: string;
	pillText: string;

	// Tabs
	tabsListBg: string; // --muted
	tabsTriggerActive: string; // --background

	mutedBg50: string; // bg-muted/50

	// Selected file highlight (now uses --accent / --muted)
	fileHighlightBg: string;
	fileHighlightText: string;
	fileText: string;
	fileIcon: string;
	accentBg: string; // --accent

	// Code (Monaco vs / vs-dark inspired)
	codeKeyword: string;
	codeString: string;
	codeTag: string;
	codeAttribute: string;
	codeComment: string;
	codeDefault: string;
	codeLineNumber: string;
	codeCursor: string;
	codeFunction: string;
	codeType: string;
	codeNumber: string;

	// Buttons
	buttonBg: string;
	buttonBgPressed: string;
	buttonPrimary: string; // --primary
	buttonPrimaryForeground: string; // --primary-foreground

	// CTA accent (Create button gradient)
	ctaAccentStart: string;
	ctaAccentMid: string;
	ctaAccentEnd: string;

	// Status
	statusSuccess: string;
	statusError: string;
	statusWarning: string;
	statusInfo: string;

	// Chart colors (kept neutral; mostly unused now)
	chart1: string;
	chart4: string;
	chart5: string;

	// Blurred deco
	blurredBg: string;
	blurredBorder: string;
	blurredPlaceholder: string;

	// Spinner
	spinnerTrack: string;
	spinnerArc: string;

	// Avatars
	assistantAvatarBg: string; // --muted
};

/**
 * Token values are eyeballed sRGB hex equivalents of the oklch tokens in
 * src/styles/globals.css. Remotion runs server-side for rendering, so we keep
 * pre-computed hex/rgba instead of relying on the browser's oklch().
 */
const dark: Theme = {
	mode: "dark",

	wallpaperGradient:
		"radial-gradient(ellipse at 30% 20%, #1a1a1a 0%, #131313 40%, #0d0d0d 100%)",
	wallpaperGlow1:
		"radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
	wallpaperGlow2:
		"radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)",

	windowTitleBar: "linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 100%)",
	windowTitleText: "rgba(255,255,255,0.4)",
	windowBorder: "rgba(255,255,255,0.10)",
	windowShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
	windowTitleBorderBottom: "rgba(255,255,255,0.06)",

	// --background oklch(0.145) ≈ #1a1a1a
	sceneBg: "#1a1a1a",
	navbarBg: "#1a1a1a",
	chatPanelBg: "#1a1a1a",
	rightPanelBg: "#1a1a1a",
	// --card oklch(0.18) ≈ #212121
	cardBg: "#212121",
	popoverBg: "#212121",
	inputBg: "rgba(255,255,255,0.06)",
	codeBg: "#1e1e1e", // VS Code dark editor bg
	codeTabBg: "#252526",
	codeTabBorder: "rgba(255,255,255,0.10)",

	iphoneBody: "#1c1c1e",
	iphoneBorder: "rgba(255,255,255,0.15)",
	iphoneNotch: "#000",
	iphoneScreenBg: "#1a1a1a",
	iphoneShadow:
		"0 50px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset",
	iphoneLiveBadgeBg: "rgba(0,0,0,0.6)",

	// --foreground oklch(0.94) ≈ #ebebeb
	textPrimary: "#ebebeb",
	textSecondary: "#a8a8a8",
	// --muted-foreground oklch(0.68) ≈ #a3a3a3
	textMuted: "#a3a3a3",
	textSubtle: "rgba(255,255,255,0.6)",
	chatUserText: "#ebebeb",
	chatAssistantText: "#d4d4d4",
	chatUserLabel: "#a3a3a3",
	chatAssistantLabel: "#a3a3a3",

	// --border oklch(1 0 0 / 12%)
	borderSubtle: "rgba(255,255,255,0.12)",
	borderLight: "rgba(255,255,255,0.10)",
	borderMedium: "rgba(255,255,255,0.18)",
	// --input oklch(1 0 0 / 16%)
	inputBorderColor: "rgba(255,255,255,0.16)",

	divider: "rgba(255,255,255,0.12)",

	// --secondary oklch(0.24) ≈ #2e2e2e
	pillBg: "#2e2e2e",
	pillBorder: "rgba(255,255,255,0.10)",
	pillText: "#d4d4d4",

	// --muted ≈ #292929
	tabsListBg: "#292929",
	tabsTriggerActive: "#1a1a1a",

	mutedBg50: "rgba(41,41,41,0.5)",

	// File highlight: --accent oklch(0.28) ≈ #363636
	fileHighlightBg: "#363636",
	fileHighlightText: "#ebebeb",
	fileText: "#ebebeb",
	fileIcon: "#a3a3a3",
	accentBg: "#363636",

	// Monaco vs-dark / Dark+ palette
	codeKeyword: "#569cd6",
	codeString: "#ce9178",
	codeTag: "#569cd6",
	codeAttribute: "#9cdcfe",
	codeComment: "#6a9955",
	codeDefault: "#d4d4d4",
	codeLineNumber: "#858585",
	codeCursor: "#aeafad",
	codeFunction: "#dcdcaa",
	codeType: "#4ec9b0",
	codeNumber: "#b5cea8",

	// --primary oklch(0.94) ≈ #ebebeb on dark
	buttonBg: "#ebebeb",
	buttonBgPressed: "#d4d4d4",
	buttonPrimary: "#ebebeb",
	buttonPrimaryForeground: "#212121",

	// CTA accent gradient (oklch dark variants)
	ctaAccentStart: "#7d8cf0", // start (blue)
	ctaAccentMid: "#b585e8", // mid (purple)
	ctaAccentEnd: "#ec85bd", // end (pink)

	// Status (dark mode oklch values)
	statusSuccess: "#26c281",
	statusError: "#f87171",
	statusWarning: "#f59e0b",
	statusInfo: "#3b82f6",

	chart1: "#cfcfcf",
	chart4: "#5c5c5c",
	chart5: "#444444",

	blurredBg: "rgba(255,255,255,0.03)",
	blurredBorder: "rgba(255,255,255,0.05)",
	blurredPlaceholder: "rgba(255,255,255,0.08)",

	// Spinner uses muted-foreground tones (no purple)
	spinnerTrack: "rgba(255,255,255,0.10)",
	spinnerArc: "#ebebeb",

	assistantAvatarBg: "#292929",
};

const light: Theme = {
	mode: "light",

	wallpaperGradient:
		"radial-gradient(ellipse at 30% 20%, #f5f5f5 0%, #f0f0f0 40%, #ebebeb 100%)",
	wallpaperGlow1:
		"radial-gradient(circle, rgba(0,0,0,0.04) 0%, transparent 70%)",
	wallpaperGlow2:
		"radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)",

	windowTitleBar: "linear-gradient(180deg, #f0f0f0 0%, #e0e0e0 100%)",
	windowTitleText: "rgba(0,0,0,0.45)",
	windowBorder: "rgba(0,0,0,0.15)",
	windowShadow: "0 25px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)",
	windowTitleBorderBottom: "rgba(0,0,0,0.08)",

	// --background oklch(0.985) ≈ #fafafa
	sceneBg: "#fafafa",
	navbarBg: "#fafafa",
	chatPanelBg: "#fafafa",
	rightPanelBg: "#fafafa",
	// --card oklch(1) = #ffffff
	cardBg: "#ffffff",
	popoverBg: "#ffffff",
	inputBg: "#f3f3f3",
	codeBg: "#ffffff", // Monaco vs theme bg
	codeTabBg: "#f3f3f3",
	codeTabBorder: "#e0e0e0",

	iphoneBody: "#f5f5f7",
	iphoneBorder: "rgba(0,0,0,0.15)",
	iphoneNotch: "#1a1a1a",
	iphoneScreenBg: "#ffffff",
	iphoneShadow:
		"0 50px 100px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05) inset",
	iphoneLiveBadgeBg: "rgba(0,0,0,0.7)",

	// --foreground oklch(0.205) ≈ #262626
	textPrimary: "#262626",
	textSecondary: "#525252",
	// --muted-foreground oklch(0.52) ≈ #737373
	textMuted: "#737373",
	textSubtle: "rgba(0,0,0,0.5)",
	chatUserText: "#262626",
	chatAssistantText: "#404040",
	chatUserLabel: "#404040",
	chatAssistantLabel: "#737373",

	// --border oklch(0.905) ≈ #e0e0e0
	borderSubtle: "#e0e0e0",
	borderLight: "#e5e5e5",
	borderMedium: "#d4d4d4",
	inputBorderColor: "#e0e0e0",

	divider: "#e0e0e0",

	// --secondary oklch(0.955) ≈ #f0f0f0
	pillBg: "#f0f0f0",
	pillBorder: "#e0e0e0",
	pillText: "#404040",

	// --muted oklch(0.965) ≈ #f3f3f3
	tabsListBg: "#f3f3f3",
	tabsTriggerActive: "#ffffff",

	mutedBg50: "rgba(243,243,243,0.5)",

	// --accent oklch(0.94) ≈ #ebebeb
	fileHighlightBg: "#ebebeb",
	fileHighlightText: "#262626",
	fileText: "#262626",
	fileIcon: "#9ca3af",
	accentBg: "#ebebeb",

	// Monaco vs theme
	codeKeyword: "#0000ff",
	codeString: "#a31515",
	codeTag: "#800000",
	codeAttribute: "#ff0000",
	codeComment: "#008000",
	codeDefault: "#000000",
	codeLineNumber: "#237893",
	codeCursor: "#000000",
	codeFunction: "#795e26",
	codeType: "#267f99",
	codeNumber: "#098658",

	// --primary oklch(0.235) ≈ #2b2b2b
	buttonBg: "#2b2b2b",
	buttonBgPressed: "#404040",
	buttonPrimary: "#2b2b2b",
	buttonPrimaryForeground: "#fafafa",

	// CTA accent gradient (oklch light variants)
	ctaAccentStart: "#5b5be6",
	ctaAccentMid: "#a560e3",
	ctaAccentEnd: "#e668b0",

	statusSuccess: "#0d9488",
	statusError: "#dc2626",
	statusWarning: "#f59e0b",
	statusInfo: "#2563eb",

	chart1: "#525252",
	chart4: "#a3a3a3",
	chart5: "#cccccc",

	blurredBg: "rgba(0,0,0,0.03)",
	blurredBorder: "rgba(0,0,0,0.05)",
	blurredPlaceholder: "rgba(0,0,0,0.08)",

	spinnerTrack: "rgba(0,0,0,0.10)",
	spinnerArc: "#262626",

	assistantAvatarBg: "#f3f3f3",
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
