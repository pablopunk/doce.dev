import { describe, expect, it, vi } from "vitest";
import { serverBootstrapIntegration } from "./astro-integration";

describe("server bootstrap Astro integration", () => {
	it("loads the real SSR module once and never awaits its detached boot", async () => {
		let resolveModule!: (module: { startServerBootstrap: () => void }) => void;
		const modulePromise = new Promise<{ startServerBootstrap: () => void }>(
			(resolve) => {
				resolveModule = resolve;
			},
		);
		const startServerBootstrap = vi.fn();
		const ssrLoadModule = vi.fn(() => modulePromise);
		const integration = serverBootstrapIntegration();
		const setup = integration.hooks["astro:server:setup"];
		if (!setup) throw new Error("missing astro:server:setup hook");

		const first = setup({ server: { ssrLoadModule } } as never);
		const second = setup({ server: { ssrLoadModule } } as never);
		expect(ssrLoadModule).toHaveBeenCalledTimes(1);
		resolveModule({ startServerBootstrap });
		await Promise.all([first, second]);
		expect(startServerBootstrap).toHaveBeenCalledTimes(2);
		expect(integration.hooks["astro:server:done"]).toBeUndefined();
	});
});
