import { saveFile } from "./db";
import { writeProjectFiles } from "./file-system";
import { copyTemplateToProject } from "./template-generator";

interface GeneratedFile {
	path: string;
	content: string;
}

interface CodeGenerationResult {
	explanation?: string;
	files: GeneratedFile[];
}

export async function generateCode(projectId: string, aiResponse: string) {
	console.log(`[CodeGen] Processing response for project ${projectId}`);

	try {
		// Try to parse JSON response first
		const parsed = JSON.parse(aiResponse);

		if (parsed.files && Array.isArray(parsed.files)) {
			console.log(
				`[CodeGen] Found JSON format with ${parsed.files.length} files`,
			);
			await processFiles(projectId, parsed.files);
			return parsed;
		}
	} catch (error) {
		// If not JSON, try to extract code blocks with file paths
		console.log(`[CodeGen] Not JSON, extracting code blocks...`);
		const files = extractCodeBlocks(aiResponse);
		console.log(`[CodeGen] Extracted ${files.length} code blocks`);

		if (files.length > 0) {
			files.forEach((f, i) => {
				console.log(
					`[CodeGen] File ${i + 1}: ${f.path} (${f.content.length} chars)`,
				);
			});
			await processFiles(projectId, files);
			return { files };
		} else {
			console.log(`[CodeGen] No code blocks found in response`);
		}
	}

	return null;
}

async function processFiles(projectId: string, files: GeneratedFile[]) {
	// Validate and fix package.json to ensure required dependencies
	const packageJsonIndex = files.findIndex((f) => f.path === "package.json");
	if (packageJsonIndex >= 0) {
		try {
			const pkg = JSON.parse(files[packageJsonIndex].content);
			// Core dependencies - only ensure these are present
			// AI can add more via runCommand tool if needed
			const requiredDeps = {
				astro: "^5.1.0",
				"@astrojs/react": "^4.4.1",
				react: "^18.3.1",
				"react-dom": "^18.3.1",
				tailwindcss: "^4.1.9",
				"@tailwindcss/postcss": "^4.1.9",
				autoprefixer: "^10.4.20",
				postcss: "^8.5.0",
				"@radix-ui/react-slot": "latest",
				"class-variance-authority": "^0.7.1",
				clsx: "^2.1.1",
				"lucide-react": "^0.468.0",
				"tailwind-merge": "^2.5.5",
				"tailwindcss-animate": "^1.0.7",
			};

			// Add devDependencies if they don't exist
			if (!pkg.devDependencies) {
				pkg.devDependencies = {};
			}

			const requiredDevDeps = {
				"@types/react": "^18.3.17",
				"@types/react-dom": "^18.3.5",
			};

			for (const [dep, version] of Object.entries(requiredDevDeps)) {
				if (!pkg.devDependencies[dep]) {
					console.log(
						`[CodeGen] Adding missing devDependency: ${dep}@${version}`,
					);
					pkg.devDependencies[dep] = version;
				}
			}

			// Ensure dependencies object exists
			if (!pkg.dependencies) {
				pkg.dependencies = {};
			}

			// Merge required dependencies (don't override if user specified different version)
			for (const [dep, version] of Object.entries(requiredDeps)) {
				if (!pkg.dependencies[dep]) {
					console.log(`[CodeGen] Adding missing dependency: ${dep}@${version}`);
					pkg.dependencies[dep] = version;
				}
			}

			files[packageJsonIndex].content = JSON.stringify(pkg, null, 2);
		} catch (error) {
			console.error(`[CodeGen] Failed to parse/fix package.json:`, error);
		}
	}

	// Validate and fix postcss.config.cjs for Tailwind v4
	const postcssConfigIndex = files.findIndex(
		(f) => f.path === "postcss.config.cjs" || f.path === "postcss.config.js",
	);
	if (postcssConfigIndex >= 0) {
		const content = files[postcssConfigIndex].content;
		// Check if using old Tailwind v3 syntax
		if (
			content.includes("tailwindcss: {}") ||
			(content.includes("tailwindcss") &&
				!content.includes("@tailwindcss/postcss"))
		) {
			console.log(
				`[CodeGen] Fixing postcss.config.cjs to use Tailwind v4 syntax`,
			);
			files[postcssConfigIndex].content = `module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {}
  }
};
`;
		}
	}

	// Validate and fix global.css for Tailwind v4
	const globalCssIndex = files.findIndex(
		(f) =>
			f.path.includes("global.css") ||
			f.path.includes("globals.css") ||
			f.path.includes("styles.css"),
	);
	if (globalCssIndex >= 0) {
		const content = files[globalCssIndex].content;
		// Check if using old Tailwind v3 syntax
		if (
			content.includes("@tailwind base") ||
			content.includes("@tailwind components") ||
			content.includes("@tailwind utilities")
		) {
			console.log(
				`[CodeGen] Fixing ${files[globalCssIndex].path} to use Tailwind v4 syntax`,
			);
			// Replace old syntax with new
			let newContent = content
				.replace(/@tailwind base;\s*/g, "")
				.replace(/@tailwind components;\s*/g, "")
				.replace(/@tailwind utilities;\s*/g, "");

			// Add import at the top if not already there
			if (!newContent.includes('@import "tailwindcss"')) {
				newContent = `@import "tailwindcss";\n\n` + newContent.trim();
			}

			files[globalCssIndex].content = newContent;
		}
	}

	// Save to database
	for (const file of files) {
		if (file.path && file.content) {
			await saveFile(projectId, file.path, file.content);
		}
	}

	// Write to file system for building
	await writeProjectFiles(projectId, files);
}

function extractCodeBlocks(text: string): GeneratedFile[] {
	const files: GeneratedFile[] = [];

	// Match code blocks with optional file path: ```tsx file="path/to/file.tsx"
	const codeBlockRegex =
		/```(?:\w+)?(?:\s+file=["']([^"']+)["'])?\s*\n([\s\S]*?)```/g;
	let match;
	let fileIndex = 0;

	console.log(
		`[CodeGen] Searching for code blocks in text of ${text.length} chars`,
	);
	console.log(`[CodeGen] First 500 chars:`, text.slice(0, 500));

	while ((match = codeBlockRegex.exec(text)) !== null) {
		const filePath = match[1];
		const content = match[2].trim();

		// Skip code blocks without a file path specified - they're probably examples or explanations
		if (!filePath) {
			console.log(
				`[CodeGen] Skipping code block without file path (${content.length} chars)`,
			);
			continue;
		}

		console.log(
			`[CodeGen] Found code block: path=${filePath}, content length=${content.length}`,
		);

		files.push({
			path: filePath,
			content: content,
		});

		fileIndex++;
	}

	console.log(`[CodeGen] Total files extracted: ${files.length}`);

	return files;
}

export async function generateDefaultProjectStructure(): Promise<
	GeneratedFile[]
> {
	// Use the astro template from templates directory
	try {
		const files = await copyTemplateToProject("astro");
		console.log(`Loaded ${files.length} files from astro template`);
		return files;
	} catch (error) {
		console.error("Failed to load astro template, using fallback:", error);
		return generateFallbackStructure();
	}
}

function generateFallbackStructure(): GeneratedFile[] {
	return [
		{
			path: "docker-compose.yml",
			content: `version: '3.8'

services:
  app:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
    ports:
      - "4321:4321"
    command: sh -c "corepack enable && corepack prepare pnpm@latest --activate && pnpm install && pnpm run dev --host 0.0.0.0 --port 4321"
    environment:
      - NODE_ENV=development
    networks:
      - doce-network

networks:
  doce-network:
    external: true
`,
		},
		{
			path: ".dockerignore",
			content: `node_modules
.astro
dist
.env
.env.local
*.log
`,
		},
		{
			path: "package.json",
			content: JSON.stringify(
				{
					name: "generated-project",
					version: "0.1.0",
					private: true,
					type: "module",
					packageManager: "pnpm@10.20.0",
					engines: {
						node: ">=20.0.0",
						pnpm: ">=9.0.0",
					},
					scripts: {
						dev: "astro dev",
						build: "astro build",
						preview: "astro preview",
					},
					dependencies: {
						astro: "^5.1.0",
						"@astrojs/react": "^4.4.1",
						react: "19.2.0",
						"react-dom": "19.2.0",
						tailwindcss: "^4.1.9",
						"@tailwindcss/postcss": "^4.1.9",
						autoprefixer: "^10.4.20",
						postcss: "^8.5.0",
					},
				},
				null,
				2,
			),
		},
		{
			path: "astro.config.mjs",
			content: `import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  vite: {
    css: {
      postcss: "./postcss.config.cjs",
    },
  },
});
`,
		},
		{
			path: "tsconfig.json",
			content: JSON.stringify(
				{
					extends: "astro/tsconfigs/strict",
					compilerOptions: {
						jsx: "react-jsx",
						jsxImportSource: "react",
						moduleResolution: "bundler",
						allowJs: true,
						esModuleInterop: true,
						resolveJsonModule: true,
						noEmit: true,
						paths: {
							"@/*": ["./src/*"],
						},
					},
					include: [".astro/types.d.ts", "src/**/*"],
					exclude: ["dist", "node_modules"],
				},
				null,
				2,
			),
		},
		{
			path: "tailwind.config.cjs",
			content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
`,
		},
		{
			path: "postcss.config.cjs",
			content: `module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`,
		},
		{
			path: "src/styles/global.css",
			content: `@import "tailwindcss";

:root {
  color-scheme: light dark;
}

body {
  font-family: system-ui, sans-serif;
  margin: 0;
  background: radial-gradient(circle at top, rgba(59,130,246,0.2), transparent 60%), #050816;
  color: white;
  min-height: 100vh;
}
`,
		},
		{
			path: "src/components/Hero.tsx",
			content: `export function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
      <span className="rounded-full border border-white/20 px-4 py-1 text-sm uppercase tracking-wide text-white/70">
        Astro + React + Tailwind
      </span>
      <h1 className="text-balance text-4xl font-bold leading-tight text-white md:text-6xl">
        Build blazing-fast sites with islands of interactivity
      </h1>
      <p className="text-balance text-white/70 md:text-lg">
        Combine Astro's content-first architecture with React components when you need client-side interactivity. Tailwind
        keeps styling consistent and fast.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="https://docs.astro.build"
          className="rounded-lg bg-white px-6 py-3 font-medium text-fg transition hover:bg-surface"
          target="_blank"
          rel="noreferrer"
        >
          Read the docs
        </a>
        <a
          href="https://astro.build/themes"
          className="rounded-lg border border-white/30 px-6 py-3 font-medium text-white transition hover:border-white"
          target="_blank"
          rel="noreferrer"
        >
          Explore themes
        </a>
      </div>
    </section>
  );
}
`,
		},
		{
			path: "src/pages/index.astro",
			content: `---
import "../styles/global.css";
import { Hero } from "@/components/Hero";
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Astro Starter</title>
  </head>
  <body>
    <Hero client:load />
  </body>
</html>
`,
		},
	];
}
