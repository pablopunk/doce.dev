import type { AstroIntegration } from "astro";

interface BootstrapModule {
	startServerBootstrap: () => void;
}

/** Development-only startup trigger. Standalone relies on middleware fallback. */
export function serverBootstrapIntegration(): AstroIntegration {
	let bootstrapModule: Promise<BootstrapModule> | null = null;

	return {
		name: "doce-server-bootstrap",
		hooks: {
			"astro:server:setup": async ({ server }) => {
				bootstrapModule ??= server.ssrLoadModule(
					"/src/server/bootstrap/index.ts",
				) as Promise<BootstrapModule>;
				(await bootstrapModule).startServerBootstrap();
			},
		},
	};
}
