import type { ProjectTemplate } from "@/domain/projects/lib/template-metadata";

export interface BootstrapPlanSection {
	title: string;
	description: string;
	tasks: string[];
}

export interface BootstrapPlan {
	templateId: string;
	projectName: string;
	projectDescription?: string;
	sections: BootstrapPlanSection[];
}

export function buildBootstrapPlan(
	template: ProjectTemplate,
	projectName: string,
	userPrompt: string,
): BootstrapPlan {
	const baseSections: BootstrapPlanSection[] = [
		{
			title: "Understand request and choose scope",
			description:
				"Summarize what the user wants and decide which parts of the template are actually needed.",
			tasks: [
				"Summarize the user prompt in 2-3 sentences.",
				"List the required pages/routes and core features.",
				"Decide whether a blog, auth, dashboard, or extra flows are required.",
			],
		},
		{
			title: "Prune unused template features",
			description:
				"Strip down the template so only the requested functionality remains.",
			tasks: [
				"Identify demo pages, routes, and modules that are not needed.",
				"Plan which directories/files to delete (without touching build/tooling configs unless necessary).",
				"Keep navigation, layouts, and core styles consistent after deletion.",
			],
		},
		{
			title: "Assemble pages from existing building blocks",
			description:
				"Compose the requested pages using the template's components/widgets/modules instead of rewriting everything from scratch.",
			tasks: [
				"List which existing components/sections will be reused on each page.",
				"Plan any new sections or components that must be added.",
				"Ensure layout, routing, and navigation remain coherent after changes.",
			],
		},
		{
			title: "Adapt content and styling",
			description:
				"Update copy, images, and basic styling to match the user's brand while staying within the template's design system.",
			tasks: [
				"List key brand elements: product name, tagline, target audience.",
				"Plan content changes section-by-section (headlines, body copy, CTAs).",
				"List any asset changes (logos, hero images, icons).",
			],
		},
		{
			title: "Wire minimal behavior and data",
			description:
				"Decide what dynamic behavior or data wiring is required for an MVP (forms, CRUD, simple state).",
			tasks: [
				"Identify any forms, authentication, or CRUD flows required by the prompt.",
				"Decide whether to keep mock data/services or replace them with simple real integrations.",
				"Plan small, incremental changes that keep the app buildable at all times.",
			],
		},
	];

	return {
		templateId: template.id,
		projectName,
		projectDescription: userPrompt,
		sections: baseSections,
	};
}

export function formatBootstrapPlanForSystem(plan: BootstrapPlan): string {
	const lines: string[] = [];
	lines.push(`Project name: ${plan.projectName}`);
	lines.push(`Template: ${plan.templateId}`);
	if (plan.projectDescription) {
		lines.push("");
		lines.push("User request:");
		lines.push(plan.projectDescription);
	}
	lines.push("");
	lines.push("Bootstrap plan (follow step by step):");
	for (const section of plan.sections) {
		lines.push("");
		lines.push(`- ${section.title}: ${section.description}`);
		for (const task of section.tasks) {
			lines.push(`  - ${task}`);
		}
	}
	return lines.join("\n");
}
