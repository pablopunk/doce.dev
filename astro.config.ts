import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { execSync } from "child_process";

const getGitVersion = (): string => {
	try {
		return execSync("git describe --tags --always --dirty", {
			encoding: "utf8",
			stdio: ["pipe", "pipe", "ignore"],
		}).trim();
	} catch {
		return "dev";
	}
};

export default defineConfig({
	output: "server",
	security: {
		checkOrigin: false,
	},
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
		define: {
			__VERSION__: JSON.stringify(process.env.VERSION || getGitVersion()),
		},
		server: {
			watch: {
				ignored: [
					"**/opencode.json",
					"**/node_modules/**",
					"**/DOCE.md",
					"**/components.json",
					"**/data/**",
					"**/server.log",
					"**/dev-server.log",
					"**/logs/**",
				],
			},
		},
	},
});
