import type { APIRoute } from "astro";
import {
	createProject,
	getProjects,
	createConversation,
	saveMessage,
	saveFile,
	getConfig,
} from "@/lib/db";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateCode } from "@/lib/code-generator";
import { copyTemplateToProject } from "@/lib/template-generator";
import { writeProjectFiles } from "@/lib/file-system";

// Helper to get AI model from database config
function getAIModel() {
	const provider = getConfig('ai_provider') || 'openrouter';
	const apiKey = getConfig(`${provider}_api_key`);
	
	if (!apiKey) {
		throw new Error(`No API key configured for ${provider}. Please complete setup at /setup`);
	}

	// Set environment variable temporarily for SDK access
	if (provider === 'openrouter') {
		const openrouter = createOpenRouter({ apiKey });
		return openrouter("openai/gpt-4.1-mini");
	} else if (provider === 'anthropic') {
		process.env.ANTHROPIC_API_KEY = apiKey;
		return anthropic("claude-3-5-sonnet-20241022");
	} else if (provider === 'openai') {
		process.env.OPENAI_API_KEY = apiKey;
		return openai("gpt-4.1-mini");
	}
	
	throw new Error(`Unknown AI provider: ${provider}`);
}

export const GET: APIRoute = async () => {
	const projects = await getProjects();
	return Response.json(projects);
};

export const POST: APIRoute = async ({ request }) => {
	const { name, description, prompt } = await request.json();

	let projectName = name;
	let projectDescription = description || prompt;

	// If a prompt is provided, generate project name with AI first
	if (prompt && !name) {
		try {
			const model = getAIModel();

			const nameResult = await generateText({
				model,
				system: `You generate concise, descriptive project names. Return ONLY the project name, nothing else. Keep it short (2-4 words), lowercase with hyphens, suitable for a folder name.`,
				prompt: `Generate a project name for: ${prompt}`,
			});

			projectName = nameResult.text
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "-")
				.replace(/-+/g, "-");
		} catch (error) {
			console.error("Failed to generate project name:", error);
			projectName = prompt
				.slice(0, 50)
				.toLowerCase()
				.replace(/[^a-z0-9-]/g, "-")
				.replace(/-+/g, "-");
		}
	}

	const project = await createProject(projectName, projectDescription);

	// If a prompt is provided, first copy the template, then let AI modify it
	if (prompt) {
		try {
			// First, copy the base Astro template
			console.log(`Copying astro template for project ${project.id}`);
			const templateFiles = await copyTemplateToProject("astro");
			await writeProjectFiles(project.id, templateFiles);
			for (const file of templateFiles) {
				await saveFile(project.id, file.path, file.content);
			}
			console.log(`Template copied: ${templateFiles.length} files`);

			const conversation = await createConversation(project.id);
			await saveMessage(conversation.id, "user", prompt);

			const model = getAIModel();

			const result = await generateText({
				model,
				system: `You are an expert web developer and designer helping users build modern sites with Astro, React islands, and Tailwind CSS.

When generating code:
- Use Astro 5 with the \`src/\` directory structure.
- Use React components for interactive islands and mark them with client directives when necessary.
- Prefer TypeScript for all .astro and .tsx files.
- Use Tailwind CSS v4 utility classes for styling.
- Provide complete, working examples that integrate with the existing project architecture (Astro + React + Tailwind + TypeScript).
- Never reference Next.js APIs or components.
- Always generate a complete starter project with package.json, config files, and at least one page.

Format code responses with markdown code blocks including file paths:
\`\`\`tsx file="src/components/MyComponent.tsx"
export function MyComponent() {
  return <div>Hello!</div>
}
\`\`\`

Always specify the file path in each code block header and generate multiple files when required to deliver a working feature.`,
				prompt: `Create a complete Astro + React + Tailwind starter project for: ${prompt}

Generate all necessary files including package.json, astro.config.mjs, tsconfig.json, tailwind.config.cjs, postcss.config.cjs, global styles, and at least one working page with components that demonstrate the requested functionality.`,
			});

			await saveMessage(conversation.id, "assistant", result.text);
			await generateCode(project.id, result.text);
		} catch (error) {
			console.error("Failed to generate initial project structure:", error);
			// Continue even if AI generation fails - user can still use the project
		}
	}

	return Response.json(project);
};
