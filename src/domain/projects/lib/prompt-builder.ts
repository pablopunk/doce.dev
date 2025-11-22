import fs from "fs/promises";
import path from "path";

/**
 * Loads the astro-starter AGENTS.md file (single source of truth
 * for generation rules for the astro-starter template).
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
 * Builds the complete prompt for AI generation using the unified astro-starter template.
 */
export async function buildGenerationPrompt(
	userPrompt: string,
): Promise<{ prompt: string }> {
	// Load template documentation (includes global rules + design system details)
	const [starterAgents] = await Promise.all([loadStarterAgentsFile()]);

	const lines: string[] = [
		"# Project Generation Request",
		"",
		"User Request:",
		userPrompt,
		"",
		"---",
		"",
		"# Base Template Information (astro-starter)",
		"",
		starterAgents,
		"",
		"---",
		"",
		"# Generation Instructions",
		"",
		"Based on the user's request above and following ALL rules and guidelines provided:",
		"",
		"1. **Always start with astro-starter** as the base template.",
		"2. **Use the pre-included UI components and styles** from `src/components/ui` and `src/styles/global.css`. Prefer shadcn/ui components (imported from `@/components/ui/*`) over custom markup when a matching component exists.",
		"3. **Respect the template's layout + style wiring**:",
		"   - `src/layouts/Layout.astro` is the canonical app shell and MUST be used for ALL pages (including `src/pages/index.astro`).",
		"   - `Layout.astro` imports `@/styles/global.css`, which in turn imports Tailwind CSS and defines the semantic design tokens.",
		"   - If you ever choose to render a page WITHOUT using `Layout.astro`, you MUST import `@/styles/global.css` at the top of that file so Tailwind and the design system are available.",
		"4. **Choose layouts, navigation, and page structure based on the user's request** (but still wrap everything with `Layout.astro`):",
		"   - If the user describes a multi-page app, create appropriate routes in `src/pages/` and link them using navigation components (for example `NavigationMenu`, `Sidebar`, `Tabs`).",
		"   - If the user describes a single-page experience, keep everything under `src/pages/index.astro` with semantic sections.",
		"5. **Use Tailwind CSS v4 with semantic tokens** (NO `dark:` classes). Always use semantic classes such as `bg-surface`, `text-fg`, `border-border`, `bg-cta` instead of hard-coded color utilities.",
		"6. **Use Astro Actions** for server-side logic (not API routes unless streaming is explicitly required).",
		"7. **Use plain SQLite (better-sqlite3)** if persistence is needed, via a small wrapper in `src/lib/db.ts`.",
		"8. **Always use pnpm** for package management.",
		"9. **Include proper TypeScript types** everywhere (components, actions, models, utilities).",
		"10. **Create complete pages** in `src/pages/` using the layout from `src/layouts/Layout.astro`.",
		"11. **Always generate `src/pages/index.astro`** as a COMPLETE page with full HTML content that demonstrates the main functionality requested by the user.",
		"12. **Use sensible shadcn/ui defaults**:",
		"    - Primary actions → `Button` (variants: default, outline, ghost).",
		"    - Layout and grouping → `Card`, `Tabs`, `Accordion`, `Table` where appropriate.",
		"    - Navigation → `NavigationMenu` or `Sidebar` when the user asks for multiple sections or pages.",
		"    - Feedback → `Toast` / `Alert` components for success and error messages.",
		"",
		"## Tool Context (doce.dev Builder)",
		"",
		"Your responses are shown inside the doce.dev builder UI, next to a file tree and a live preview area.",
		"This builder manages project creation, dependency installation, Docker-based preview, and deployment for the user.",
		"",
		"When writing any user-facing text (README content, on-page copy, console logs, comments, or your natural-language explanation), you MUST:",
		"",
		"- NOT tell the user to run local dev commands like `pnpm dev`, `npm install`, or similar, unless they explicitly asked for local setup instructions.",
		"- NOT tell the user to visit hard-coded URLs such as `http://localhost:3000` or specific ports. The preview runs inside a Docker container on an automatically assigned port and is surfaced by the builder UI.",
		"- Describe running/viewing the app in neutral terms like 'preview this project in the builder' or 'use the preview provided by the tool' instead of local machine instructions.",
		"- Keep natural-language explanation concise and focused on how the generated UI behaves and how to use it, not on environment setup steps the builder already handles.",
		"",
		"## Output Format",
		"",
		"Provide your response as code blocks with file paths:",
		"",
		'```astro file="src/pages/index.astro"',
		"---",
		'import Layout from "@/layouts/Layout.astro";',
		"---",
		"",
		'<Layout title="Home">',
		"  <!-- Complete page content here -->",
		"</Layout>",
		"```",
		"",
		'```typescript file="src/lib/db.ts"',
		"// Database code if needed",
		"```",
		"",
		"Generate ALL necessary files to make this project work immediately after copying.",
	];

	const fullPrompt = lines.join("\n");

	return {
		prompt: fullPrompt,
	};
}
