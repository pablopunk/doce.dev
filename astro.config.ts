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
	},
	integrations: [react()],
	vite: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		plugins: [tailwindcss() as any],
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
});
