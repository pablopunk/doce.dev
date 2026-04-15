#!/usr/bin/env node
/**
 * Single source of truth for the OpenCode version used across doce.dev.
 *
 * The OpenCode server version is tightly coupled to the SDK/plugin code paths
 * (e.g. the sync `session.prompt` endpoint only exists in certain versions),
 * so all four locations below MUST stay in sync:
 *
 *   - Dockerfile (central runtime, installs `opencode` CLI)
 *   - templates/astro-starter/Dockerfile.opencode (per-project runtime)
 *   - package.json (@opencode-ai/sdk)
 *   - templates/astro-starter/package.json (@opencode-ai/plugin)
 *
 * Usage:
 *   node scripts/opencode-version.mjs check   # verify all locations match
 *   node scripts/opencode-version.mjs sync    # rewrite all locations from .opencode-version
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_FILE = join(ROOT, ".opencode-version");

const EXPECTED = readFileSync(SOURCE_FILE, "utf8").trim();

const TARGETS = [
	{
		path: join(ROOT, "Dockerfile"),
		label: "Dockerfile (central opencode CLI)",
		pattern: /(opencode\.ai\/install \| bash -s -- --version )(\S+)/,
	},
	{
		path: join(ROOT, "package.json"),
		label: "package.json (@opencode-ai/sdk)",
		pattern: /("@opencode-ai\/sdk":\s*")\^?([^"]+)(")/,
		replaceWithCaret: true,
	},
	{
		path: join(ROOT, "templates/astro-starter/package.json"),
		label: "templates/astro-starter/package.json (@opencode-ai/plugin)",
		pattern: /("@opencode-ai\/plugin":\s*")\^?([^"]+)(")/,
		replaceWithCaret: true,
	},
];

function readVersion(target) {
	const content = readFileSync(target.path, "utf8");
	const match = content.match(target.pattern);
	if (!match) {
		throw new Error(`Could not find version marker in ${target.label}`);
	}
	return { content, version: match[2], match };
}

function check() {
	const issues = [];
	for (const target of TARGETS) {
		const { version } = readVersion(target);
		if (version !== EXPECTED) {
			issues.push(`  ${target.label}: expected ${EXPECTED}, found ${version}`);
		}
	}

	if (issues.length > 0) {
		console.error(
			`✖ OpenCode version drift detected. Source of truth (.opencode-version) is ${EXPECTED}:\n${issues.join("\n")}\n\nRun:  pnpm opencode:sync`,
		);
		process.exit(1);
	}

	console.log(`✔ OpenCode version ${EXPECTED} is in sync across all locations.`);
}

function sync() {
	let changed = 0;
	for (const target of TARGETS) {
		const { content, version } = readVersion(target);
		if (version === EXPECTED) continue;

		const replacement = target.replaceWithCaret
			? `$1^${EXPECTED}$3`
			: `$1${EXPECTED}`;
		const next = content.replace(target.pattern, replacement);
		writeFileSync(target.path, next);
		console.log(`  updated ${target.label}: ${version} → ${EXPECTED}`);
		changed++;
	}

	if (changed === 0) {
		console.log(`✔ Already in sync at ${EXPECTED}.`);
	} else {
		console.log(
			`\n✔ Synced ${changed} file(s) to ${EXPECTED}. Run \`pnpm install\` to refresh lockfiles.`,
		);
	}
}

const cmd = process.argv[2];
if (cmd === "check") check();
else if (cmd === "sync") sync();
else {
	console.error("Usage: opencode-version.mjs <check|sync>");
	process.exit(2);
}
