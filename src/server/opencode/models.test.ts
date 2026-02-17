import { toVendorSlug } from "@/lib/modelVendor";
import { resolveModelVendor } from "./models";

interface TestResult {
	test: string;
	passed: boolean;
	error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void): void {
	try {
		fn();
		results.push({ test: name, passed: true });
		console.log(`PASS ${name}`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		results.push({ test: name, passed: false, error: errorMessage });
		console.log(`FAIL ${name}: ${errorMessage}`);
	}
}

function assertEqual(
	actual: unknown,
	expected: unknown,
	message?: string,
): void {
	if (actual !== expected) {
		throw new Error(
			message ?? `Expected ${String(expected)}, got ${String(actual)}`,
		);
	}
}

test("direct OpenAI provider resolves to openai", () => {
	assertEqual(resolveModelVendor("openai", "gpt-5.2-codex"), "openai");
});

test("OpenRouter vendor/model format resolves vendor from model ID", () => {
	assertEqual(
		resolveModelVendor("openrouter", "openai/gpt-5.2-codex"),
		"openai",
	);
});

test("OpenRouter vendor extraction normalizes case", () => {
	assertEqual(resolveModelVendor("openrouter", "OpenAI/gpt-4.1"), "openai");
});

test("OpenCode gpt model infers openai vendor", () => {
	assertEqual(resolveModelVendor("opencode", "gpt-5-codex"), "openai");
});

test("OpenCode claude model infers anthropic vendor", () => {
	assertEqual(resolveModelVendor("opencode", "claude-sonnet-4.5"), "anthropic");
});

test("OpenCode model with vendor/model format uses explicit vendor", () => {
	assertEqual(
		resolveModelVendor("opencode", "google/gemini-3-flash"),
		"google",
	);
});

test("zai provider alias normalizes to z-ai", () => {
	assertEqual(resolveModelVendor("zai", "glm-5"), "z-ai");
});

test("x-ai provider alias normalizes to xai", () => {
	assertEqual(resolveModelVendor("x-ai", "grok-4"), "xai");
});

test("OpenCode unknown model falls back to opencode provider slug", () => {
	assertEqual(resolveModelVendor("opencode", "custom-model"), "opencode");
});

test("vendor slug strips punctuation for z.ai", () => {
	assertEqual(toVendorSlug("z.ai"), "z-ai");
});

test("vendor slug strips punctuation for zai", () => {
	assertEqual(toVendorSlug("zai"), "z-ai");
});

test("vendor slug strips punctuation for openai.com", () => {
	assertEqual(toVendorSlug("openai.com"), "openai");
});

test("vendor slug strips punctuation for open-ai", () => {
	assertEqual(toVendorSlug("open-ai"), "openai");
});

test("vendor slug lowercases and canonicalizes moonshotai", () => {
	assertEqual(toVendorSlug("MoonshotAI"), "moonshot");
});

const passed = results.filter((result) => result.passed).length;
const failed = results.length - passed;

console.log(`\n${passed}/${results.length} tests passed`);

if (failed > 0) {
	process.exitCode = 1;
}
