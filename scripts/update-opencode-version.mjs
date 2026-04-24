#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const VERSION_FILE = ".opencode-version";

function readVersion() {
	return fs.readFileSync(VERSION_FILE, "utf-8").trim();
}

function writeVersion(version) {
	fs.writeFileSync(VERSION_FILE, `${version}\n`);
}

const args = process.argv.slice(2);
let newVersion;

if (args.length >= 1) {
	newVersion = args[0];
	writeVersion(newVersion);
	console.log(`Updated ${VERSION_FILE} to ${newVersion}`);
} else {
	newVersion = readVersion();
	console.log(`Source of truth: ${VERSION_FILE} = ${newVersion}`);
}

if (!newVersion) {
	console.error("Error: version is empty");
	process.exit(1);
}

// 1. Update Dockerfile
const dockerfilePath = "Dockerfile";
if (fs.existsSync(dockerfilePath)) {
	let content = fs.readFileSync(dockerfilePath, "utf-8");
	const match = content.match(
		/opencode\.ai\/install.*--version ([0-9]+\.[0-9]+\.[0-9]+)/,
	);
	if (match) {
		const current = match[1];
		if (current !== newVersion) {
			content = content.replace(
				`--version ${current}`,
				`--version ${newVersion}`,
			);
			fs.writeFileSync(dockerfilePath, content);
			console.log(`  Dockerfile: ${current} -> ${newVersion}`);
		} else {
			console.log(`  Dockerfile: already at ${newVersion}`);
		}
	} else {
		console.log(`  Dockerfile: could not detect current opencode version`);
	}
}

// 2. Update package.json
const packageJsonPath = "package.json";
if (fs.existsSync(packageJsonPath)) {
	const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
	const dep = pkg.dependencies?.["@opencode-ai/sdk"];
	const current = dep?.replace(/^\^/, "");
	if (current) {
		if (current !== newVersion) {
			pkg.dependencies["@opencode-ai/sdk"] = `^${newVersion}`;
			fs.writeFileSync(
				packageJsonPath,
				`${JSON.stringify(pkg, null, "\t")}\n`,
			);
			console.log(`  package.json: ${current} -> ${newVersion}`);
		} else {
			console.log(`  package.json: already at ${newVersion}`);
		}
	} else {
		console.log(`  package.json: could not detect current @opencode-ai/sdk version`);
	}
}

// 3. Update pnpm-lock.yaml via pnpm install
const lockfilePath = "pnpm-lock.yaml";
if (fs.existsSync(lockfilePath)) {
	const content = fs.readFileSync(lockfilePath, "utf-8");
	const match = content.match(/'@opencode-ai\/sdk@([0-9]+\.[0-9]+\.[0-9]+)'/);
	if (match) {
		const current = match[1];
		if (current !== newVersion) {
			console.log(`  Running pnpm install to update pnpm-lock.yaml...`);
			try {
				execSync("pnpm install --no-frozen-lockfile", {
					stdio: "inherit",
				});
				console.log(`  pnpm-lock.yaml updated`);
			} catch {
				console.error(`  Error: pnpm install failed`);
				process.exit(1);
			}
		} else {
			console.log(`  pnpm-lock.yaml: already at ${newVersion}`);
		}
	} else {
		console.log(`  pnpm-lock.yaml: could not detect current version`);
	}
}

console.log("Done.");
