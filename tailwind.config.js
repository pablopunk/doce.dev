/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["selector", ".dark"],
	theme: {
		extend: {},
	},
	plugins: [require("@tailwindcss/typography")],
};
