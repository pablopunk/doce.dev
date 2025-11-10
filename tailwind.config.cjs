/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{astro,js,ts,jsx,tsx}", "./app/**/*.{ts,tsx}"],
	darkMode: ["class"],
	theme: {
		extend: {
			backgroundImage: {
				"gradient-conic": "conic-gradient(var(--tw-gradient-stops))",
				"gradient-subtle":
					"linear-gradient(to bottom, var(--bg-raised), var(--bg-surface))",
			},
		},
	},
	plugins: [require("@tailwindcss/typography")],
};
