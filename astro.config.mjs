import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "url";

export default defineConfig({
	output: "server",
	adapter: node({
		mode: "standalone",
	}),
	integrations: [react()],
	vite: {
		css: {
			postcss: "./postcss.config.cjs",
		},
		resolve: {
			alias: {
				"@": fileURLToPath(new URL("./src", import.meta.url)),
			},
		},
		ssr: {
			external: [
				"ai",
				"@ai-sdk/anthropic",
				"@ai-sdk/openai",
				"dockerode",
				"better-sqlite3",
			],
		},
		server: {
			watch: {
				// Exclude data directory containing generated projects to avoid "too many open files" error
        ignored: ["**/data/**", "**/node_modules/**", "**/.git/**", "/AGENTS.md"],
			},
		},
	},
});
