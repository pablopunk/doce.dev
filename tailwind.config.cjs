/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{astro,js,ts,jsx,tsx}", "./app/**/*.{ts,tsx}"],
	darkMode: ["class"],
	theme: {
		extend: {
			colors: {
				// Semantic color system
				"bg-base": "var(--bg-base)",
				"bg-surface": "var(--bg-surface)",
				"bg-raised": "var(--bg-raised)",
				"bg-hover": "var(--bg-hover)",
				"bg-active": "var(--bg-active)",
				"bg-cta": "var(--bg-cta)",
				"bg-cta-hover": "var(--bg-cta-hover)",
				"text-primary": "var(--text-primary)",
				"text-secondary": "var(--text-secondary)",
				"text-tertiary": "var(--text-tertiary)",
				"text-disabled": "var(--text-disabled)",
				"border-subtle": "var(--border-subtle)",
				"border-default": "var(--border-default)",
				"border-focus": "var(--border-focus)",
				overlay: "var(--overlay)",
				highlight: "var(--highlight)",
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
