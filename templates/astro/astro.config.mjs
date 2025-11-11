import react from "@astrojs/react";
import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	site: "https://example.com", // Replace with your production URL
	output: "server",
	adapter: node({
		mode: "standalone",
	}),
	integrations: [react()],
	vite: {
    plugins: [tailwindcss()],
	},
});
