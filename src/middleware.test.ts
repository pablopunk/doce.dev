import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	ensureDatabaseReady: vi.fn(),
	selectUsers: vi.fn(),
	startServerBootstrap: vi.fn(),
	validateSession: vi.fn(),
}));

vi.mock("@/server/bootstrap", () => ({
	startServerBootstrap: mocks.startServerBootstrap,
}));
vi.mock("@/server/db/ensure-db", () => ({
	ensureDatabaseReady: mocks.ensureDatabaseReady,
}));
vi.mock("@/server/db/client", () => ({
	db: { select: () => ({ from: () => ({ limit: mocks.selectUsers }) }) },
}));
vi.mock("@/server/auth/sessions", () => ({
	validateSession: mocks.validateSession,
}));
vi.mock("@/server/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn() },
}));
vi.mock("astro:middleware", () => ({
	defineMiddleware: <T>(middleware: T) => middleware,
	sequence:
		(
			...middleware: Array<
				(context: unknown, next: () => Promise<Response>) => Promise<Response>
			>
		) =>
		(context: unknown, next: () => Promise<Response>) => {
			const run = (index: number): Promise<Response> => {
				const current = middleware[index];
				return current ? current(context, () => run(index + 1)) : next();
			};
			return run(0);
		},
}));

const { onRequest } = await import("./middleware");

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

describe("middleware bootstrap fallback", () => {
	it("starts bootstrap once at module evaluation and waits only for database readiness", async () => {
		const database = deferred();
		mocks.ensureDatabaseReady.mockReturnValueOnce(database.promise);
		mocks.selectUsers.mockResolvedValueOnce([]);
		const next = vi.fn(() => Promise.resolve(new Response("next")));
		const context = {
			url: new URL("http://doce.test/"),
			cookies: { get: vi.fn(), delete: vi.fn() },
			locals: {},
			redirect: (location: string) =>
				new Response(null, { status: 302, headers: { location } }),
		};

		const responsePromise = onRequest(context as never, next);
		await Promise.resolve();
		expect(next).not.toHaveBeenCalled();
		expect(mocks.startServerBootstrap).toHaveBeenCalledTimes(1);
		database.resolve();
		const response = await responsePromise;
		if (!(response instanceof Response)) throw new Error("missing response");
		expect(response.headers.get("location")).toBe("/setup");
		expect(next).not.toHaveBeenCalled();
	});
});
