/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{astro,js,ts,jsx,tsx}", "./app/**/*.{ts,tsx}"],
	darkMode: ["class"],
	theme: {
		extend: {
			colors: {
				// Background layers (depth system: base → surface → raised → cta)
				background: {
					DEFAULT: "var(--bg-base)",
					base: "var(--bg-base)",
					surface: "var(--bg-surface)",
					raised: "var(--bg-raised)",
					hover: "var(--bg-hover)",
					active: "var(--bg-active)",
					cta: "var(--bg-cta)",
					"cta-hover": "var(--bg-cta-hover)",
					muted: "var(--bg-muted)",        // Alias for surface
				},
				// Foreground hierarchy (text colors)
				foreground: {
					DEFAULT: "var(--foreground-primary)",
					primary: "var(--foreground-primary)",
					secondary: "var(--foreground-secondary)",
					tertiary: "var(--foreground-tertiary)",
					disabled: "var(--foreground-disabled)",
					muted: "var(--foreground-muted)",       // Alias for secondary
					subtle: "var(--foreground-subtle)",     // Alias for tertiary
				},
				// Border weights
				border: {
					DEFAULT: "var(--border-default)",
					subtle: "var(--border-subtle)",
					default: "var(--border-default)",
					focus: "var(--border-focus)",
				},
				// Special colors
				overlay: "var(--overlay)",
				highlight: "var(--highlight)",

				// shadcn/ui compatibility (kept as single values for components)
				card: "var(--bg-surface)",
				"card-foreground": "var(--foreground-primary)",
				popover: "var(--bg-raised)",
				"popover-foreground": "var(--foreground-primary)",
				primary: "var(--primary)",
				"primary-foreground": "var(--primary-contrast)",
				secondary: "var(--foreground-secondary)",
				"secondary-foreground": "var(--foreground-tertiary)",
				muted: "var(--bg-surface)",
				"muted-foreground": "var(--foreground-secondary)",
				accent: "var(--bg-raised)",
				"accent-foreground": "var(--foreground-primary)",
				destructive: "var(--danger)",
				"destructive-foreground": "oklch(0.95 0.02 20)",
				input: "var(--bg-raised)",
				ring: "var(--primary)",
			},
			boxShadow: {
				elevation: "0 2px 4px var(--shadow-1), 0 8px 16px var(--shadow-2)",
				"elevation-lg":
					"0 4px 8px var(--shadow-1), 0 16px 32px var(--shadow-2)",
			},
			backgroundImage: {
				"gradient-conic": "conic-gradient(var(--tw-gradient-stops))",
				"gradient-subtle":
					"linear-gradient(to bottom, var(--bg-raised), var(--bg-surface))",
			},
		},
	},
	plugins: [require("@tailwindcss/typography")],
};
