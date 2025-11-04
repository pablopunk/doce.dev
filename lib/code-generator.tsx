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
    const filePath = match[1] || `app/generated-${fileIndex}.tsx`
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
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
          },
          dependencies: {
            next: "16.0.0",
            react: "19.0.0",
            "react-dom": "19.0.0",
          },
          devDependencies: {
            "@types/node": "^22.0.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            typescript: "^5.0.0",
            tailwindcss: "^4.0.0",
          },
        },
        null,
        2,
      ),
    },
    {
      path: "next.config.mjs",
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

export default nextConfig
`,
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            forceConsistentCasingInFileNames: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [{ name: "next" }],
            paths: {
              "@/*": ["./*"],
            },
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"],
        },
        null,
        2,
      ),
    },
    {
      path: "app/globals.css",
      content: `@import "tailwindcss";

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
`,
    },
    {
      path: "app/layout.tsx",
      content: `import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
    },
    {
      path: "app/page.tsx",
      content: `export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome</h1>
        <p className="text-muted-foreground">Start building your website</p>
      </div>
    </main>
  )
}
`,
    },
  ]
}
