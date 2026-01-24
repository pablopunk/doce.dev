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
		allowedHosts: true,
	},
	integrations: [react()],
	vite: {
		plugins: [tailwindcss()],
		server: {
			watch: {
				ignored: [
					"**/opencode.json",
					"**/node_modules/**",
					"**/DOCE.md",
					"**/components.json",
				],
			},
		},
	},
	devToolbar: {
		enabled: false,
	},
});
