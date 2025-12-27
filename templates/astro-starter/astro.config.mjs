import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "server",
	adapter: node({
		mode: "standalone",
	}),
	server: {
		host: true,
		port: 4321,
	},
	integrations: [react()],
	vite: {
		plugins: [tailwindcss()],
	},
	devToolbar: {
		enabled: false,
	},
});
