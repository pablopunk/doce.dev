import { saveFile } from "./db"
import { writeProjectFiles } from "./file-system"

interface GeneratedFile {
  path: string
  content: string
}

interface CodeGenerationResult {
  explanation?: string
  files: GeneratedFile[]
}

export async function generateCode(projectId: string, aiResponse: string) {
  try {
    // Try to parse JSON response first
    const parsed = JSON.parse(aiResponse)

    if (parsed.files && Array.isArray(parsed.files)) {
      await processFiles(projectId, parsed.files)
      return parsed
    }
  } catch (error) {
    // If not JSON, try to extract code blocks with file paths
    const files = extractCodeBlocks(aiResponse)
    if (files.length > 0) {
      await processFiles(projectId, files)
      return { files }
    }
  }

  return null
}

async function processFiles(projectId: string, files: GeneratedFile[]) {
  // Save to database
  for (const file of files) {
    if (file.path && file.content) {
      await saveFile(projectId, file.path, file.content)
    }
  }

  // Write to file system for building
  await writeProjectFiles(projectId, files)
}

function extractCodeBlocks(text: string): GeneratedFile[] {
  const files: GeneratedFile[] = []

  // Match code blocks with optional file path: ```tsx file="path/to/file.tsx"
  const codeBlockRegex = /```(?:\w+)?(?:\s+file=["']([^"']+)["'])?\s*\n([\s\S]*?)```/g
  let match
  let fileIndex = 0

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const filePath = match[1] || `src/pages/generated-${fileIndex}.astro`
    const content = match[2].trim()

    files.push({
      path: filePath,
      content: content,
    })

    fileIndex++
  }

  return files
}

export function generateDefaultProjectStructure(): GeneratedFile[] {
  return [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "generated-project",
          version: "0.1.0",
          private: true,
          type: "module",
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
          className="rounded-lg bg-white px-6 py-3 font-medium text-slate-900 transition hover:bg-slate-200"
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
  ]
}
