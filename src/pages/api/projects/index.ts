import type { APIRoute } from "astro";
import { projectFacade } from "@/application/facades/project-facade";
import {
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
import { DEFAULT_AI_MODEL } from "@/shared/config/ai-models";

// Helper to get AI model from database config
function getAIModel() {
	const provider = getConfig('ai_provider') || 'openrouter';
	const apiKey = getConfig(`${provider}_api_key`);
	const defaultModel = getConfig('default_ai_model') || DEFAULT_AI_MODEL;
	
	if (!apiKey) {
		throw new Error(`No API key configured for ${provider}. Please complete setup at /setup`);
	}

	// OpenRouter supports all models through their unified API
	if (provider === 'openrouter') {
		const openrouter = createOpenRouter({ apiKey });
		return openrouter(defaultModel);
	}
	
	// For direct providers, extract the model ID and use their SDK
	const [modelProvider, ...modelParts] = defaultModel.split('/');
	const modelId = modelParts.join('/');
	
	if (modelProvider === 'anthropic' && provider === 'anthropic') {
		process.env.ANTHROPIC_API_KEY = apiKey;
		return anthropic(modelId || "claude-3-5-sonnet-20241022");
	} else if (modelProvider === 'openai' && provider === 'openai') {
		process.env.OPENAI_API_KEY = apiKey;
		return openai(modelId || "gpt-4.1-mini");
	}
	
	// Fallback: if provider is openrouter, use it regardless of model format
	if (provider === 'openrouter') {
		const openrouter = createOpenRouter({ apiKey });
		return openrouter(defaultModel);
	}
	
	throw new Error(`Model ${defaultModel} not compatible with provider ${provider}`);
}

export const GET: APIRoute = async () => {
	// USE NEW ARCHITECTURE
	const projects = await projectFacade.getProjects();
	
	// Convert domain models to API response
	const response = projects.map(p => p.toJSON());
	
	return Response.json(response);
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

	// USE NEW ARCHITECTURE
	const project = await projectFacade.createProject(projectName, projectDescription);

	// If a prompt is provided, generate a minimal starter and let AI build from there
	if (prompt) {
		try {
			// Copy minimal template files (config only, no example components)
			console.log(`Copying minimal template for project ${project.id}`);
			const templateFiles = await copyTemplateToProject("astro");
			
			// Filter out example files - keep only config and essential structure
			const minimalFiles = templateFiles.filter(file => {
				// Keep config files, package.json, and base layouts
				if (file.path.includes('package.json')) return true;
				if (file.path.includes('astro.config.mjs')) return true;
				if (file.path.includes('tsconfig.json')) return true;
				if (file.path.includes('tailwind.config.cjs')) return true;
				if (file.path.includes('postcss.config.cjs')) return true;
				if (file.path.includes('.npmrc')) return true;
				if (file.path.includes('.dockerignore')) return true;
				if (file.path.includes('docker-compose')) return true;
				if (file.path.includes('global.css')) return true;
				if (file.path.includes('BaseLayout.astro')) return true;
				// Skip example components and pages - let AI generate fresh ones
				return false;
			});
			
			await writeProjectFiles(project.id, minimalFiles);
			for (const file of minimalFiles) {
				await saveFile(project.id, file.path, file.content);
			}
			console.log(`Minimal template copied: ${minimalFiles.length} files`);

			const conversation = await createConversation(project.id);
			await saveMessage(conversation.id, "user", prompt);

			const model = getAIModel();

			const result = await generateText({
				model,
				system: `You are an expert web developer and designer helping users build modern sites with Astro, React islands, and Tailwind CSS.

A minimal Astro project template has been set up with the following files:
- package.json (with Astro, React, Tailwind v4 dependencies)
- astro.config.mjs (with React integration)
- tsconfig.json
- tailwind.config.cjs
- postcss.config.cjs (configured for Tailwind v4)
- src/styles/global.css (with @import "tailwindcss")
- src/layouts/BaseLayout.astro (imports global.css)

Your job is to generate ONLY the application-specific files needed for the user's request:
- src/pages/index.astro - The main landing page
- src/components/*.tsx - React components for interactive features
- Any additional pages or components needed

When generating code:
- Use Astro 5 with the \`src/\` directory structure.
- Use React components for interactive islands and mark them with client directives (client:load, client:visible, etc.).
- Import BaseLayout or use it as a layout for pages.
- Prefer TypeScript for all .astro and .tsx files.
- Use Tailwind CSS v4 utility classes for styling.
- Provide complete, working examples.
- Never reference Next.js APIs or components.
- DO NOT regenerate config files (package.json, astro.config.mjs, etc.) unless specifically needed for the feature.

Format code responses with markdown code blocks including file paths:
\`\`\`tsx file="src/components/MyComponent.tsx"
export function MyComponent() {
  return <div>Hello!</div>
}
\`\`\`

Always specify the file path in each code block header and generate multiple files when required to deliver a working feature.`,
				prompt: `Create a working Astro + React + Tailwind application for: ${prompt}

Generate the necessary pages and components. Focus on creating a functional, well-designed implementation with good UX.`,
			});

			await saveMessage(conversation.id, "assistant", result.text);
			await generateCode(project.id, result.text);
			
			console.log(`Initial project generation completed for ${project.id}`);
		} catch (error) {
			console.error("Failed to generate initial project structure:", error);
			// Continue even if AI generation fails - user can still use the project
		}
	}

	return Response.json(project);
};
