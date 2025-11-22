import fs from "fs/promises";
import path from "path";

/**
 * Loads the global rules file for AI generation (templates/AGENTS.md)
 */
export async function loadGlobalRules(): Promise<string> {
	const globalRulesPath = path.join(process.cwd(), "templates", "AGENTS.md");
	try {
		return await fs.readFile(globalRulesPath, "utf-8");
	} catch (error) {
		console.error("Failed to load templates/AGENTS.md:", error);
		return "";
	}
}

/**
 * Loads shadcn-tailwind design system documentation (AGENTS.md)
 */
export async function loadDesignSystemDocs(): Promise<string> {
	const docsPath = path.join(
		process.cwd(),
		"templates",
		"design-systems",
		"shadcn-tailwind",
		"AGENTS.md",
	);
	try {
		return await fs.readFile(docsPath, "utf-8");
	} catch (error) {
		console.error(
			`Failed to load design-systems/shadcn-tailwind/AGENTS.md:`,
			error,
		);
		return "";
	}
}

/**
 * Loads the astro-starter AGENTS.md file
 */
export async function loadStarterAgentsFile(): Promise<string> {
	const agentsPath = path.join(
		process.cwd(),
		"templates",
		"astro-starter",
		"AGENTS.md",
	);
	try {
		return await fs.readFile(agentsPath, "utf-8");
	} catch (error) {
		console.error("Failed to load astro-starter AGENTS.md:", error);
		return "";
	}
}

/**
 * Builds the complete prompt for AI generation including global rules and design system docs
 */
export async function buildGenerationPrompt(
	userPrompt: string,
): Promise<{ prompt: string }> {
	// Load all documentation
	const [globalRules, designSystemDocs, starterAgents] = await Promise.all([
		loadGlobalRules(),
		loadDesignSystemDocs(),
		loadStarterAgentsFile(),
	]);

	// Build comprehensive prompt
	const fullPrompt = `# Project Generation Request

User Request:
${userPrompt}

---

# Global Rules (Apply to ALL projects)

${globalRules}

---

# Design System: shadcn/ui + Tailwind CSS v4

${designSystemDocs}

---

# Base Template Information (astro-starter)

${starterAgents}

---

# Generation Instructions

Based on the user's request above and following ALL rules and guidelines provided:

1. **Always start with astro-starter** as the base template
2. **Use shadcn/ui components, layouts, and styles**
3. **Generate complete, working code** with proper file structure
4. **Follow Tailwind CSS v4 guidelines** (no dark: classes, use semantic colors)
5. **Use Astro Actions** for server-side logic (not API routes unless streaming)
6. **Use plain SQLite** (better-sqlite3) if persistence is needed
7. **Always use pnpm** for package management
8. **Include proper TypeScript types** everywhere
9. **Create complete pages** in src/pages/ with proper layouts
10. **Generate src/pages/index.astro** as a COMPLETE page with full HTML

## Output Format

Provide your response as code blocks with file paths:

\`\`\`astro file="src/pages/index.astro"
---
import Layout from "@/layouts/Layout.astro";
---

<Layout title="Home">
  <!-- Complete page content here -->
</Layout>
\`\`\`

\`\`\`typescript file="src/lib/db.ts"
// Database code if needed
\`\`\`

Generate ALL necessary files to make this project work immediately after copying.
`;

	return {
		prompt: fullPrompt,
	};
}
