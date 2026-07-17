import { beforeEach, describe, expect, it, vi } from "vitest";

const { getTailscaleConfig } = vi.hoisted(() => ({
	getTailscaleConfig: vi.fn(),
}));

vi.mock("./config", () => ({ getTailscaleConfig }));

import { getTailscaleProjectUrl, invalidateTailscaleUrlCache } from "./urls";

describe("getTailscaleProjectUrl", () => {
	beforeEach(() => {
		invalidateTailscaleUrlCache();
		getTailscaleConfig.mockReset();
		getTailscaleConfig.mockResolvedValue({
			enabled: true,
			authKey: null,
			hostname: "doce",
			tailnetName: "example.ts.net",
		});
	});

	it("shares one config lookup across concurrent project URL builds", async () => {
		const urls = await Promise.all(
			Array.from({ length: 6 }, (_, index) =>
				getTailscaleProjectUrl(
					`project-${index}`,
					"preview",
					`project-${index}`,
				),
			),
		);

		expect(getTailscaleConfig).toHaveBeenCalledTimes(1);
		expect(urls).toEqual([
			"https://project-0-proje-preview.example.ts.net",
			"https://project-1-proje-preview.example.ts.net",
			"https://project-2-proje-preview.example.ts.net",
			"https://project-3-proje-preview.example.ts.net",
			"https://project-4-proje-preview.example.ts.net",
			"https://project-5-proje-preview.example.ts.net",
		]);
	});

	it("preserves production URL construction", async () => {
		await expect(
			getTailscaleProjectUrl("my-project", "production", "abcde12345"),
		).resolves.toBe("https://my-project-abcde.example.ts.net");
	});
});
