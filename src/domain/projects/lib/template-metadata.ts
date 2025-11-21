export interface ProjectTemplate {
	id: string;
	name: string;
	folder: string;
	description: string;
	bestFor: string[];
	modificationHints: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
	{
		id: "astro-vercel-sdk-ai-chatbot",
		name: "Astro AI Chatbot",
		folder: "astro-vercel-sdk-ai-chatbot",
		description:
			"Astro 5 + React + Tailwind v4 template focused on full-screen AI chat applications with mocked backends that can be swapped for real providers.",
		bestFor: [
			"AI chatbots and assistants",
			"Playground UIs for LLMs",
			"Single-page conversational products",
		],
		modificationHints:
			"Wire real AI and storage by replacing or wrapping the mocks in src/mocks/*, keep Chatbot.tsx as the main orchestrator, and adjust styles and layout through src/components and src/styles/global.css.",
	},
	{
		id: "astrowind",
		name: "Astrowind Marketing Site",
		folder: "astrowind",
		description:
			"Feature-rich Astro + Tailwind starter for marketing sites, blogs, and portfolios with many example pages and widgets.",
		bestFor: [
			"Product or SaaS marketing sites",
			"Single-page or multi-page landings",
			"Portfolios and simple content sites",
		],
		modificationHints:
			"Start from src/pages/index.astro and a single layout, compose pages from widgets under src/components/widgets, then aggressively delete unused homes, landing variants, blog routes, demo posts, and platform-specific config.",
	},
	{
		id: "astro-starter",
		name: "Astro Starter",
		folder: "astro-starter",
		description:
			"Minimal Astro 5 starter for small tools, content-light apps, and simple marketing pages with an SEO-focused base layout.",
		bestFor: [
			"Simple tools and utilities",
			"Content-light marketing or landing pages",
			"Quick one-off microsites with SEO",
		],
		modificationHints:
			"Replace src/pages/index.astro and src/components/Welcome.astro with your own content, keep src/layouts/Layout.astro as the shared shell for SEO and meta, and configure SITE_URL and APP_ENV via .env and astro.config.mjs instead of hard-coding URLs.",
	},
	{
		id: "storeplate",
		name: "Storeplate Shopify Storefront",
		folder: "storeplate",
		description:
			"Large Astro + Shopify + Tailwind storefront template for modern e-commerce sites backed by the Shopify Storefront GraphQL API.",
		bestFor: [
			"Full Shopify storefronts",
			"Product catalog and marketing hybrids",
			"E-commerce prototypes that can scale up",
		],
		modificationHints:
			"Start by configuring src/config/*.json and .env for your store, then prune unused pages under src/pages, interactive islands in src/layouts/functional-components, and extra content in src/content to match the required catalog, keeping Shopify data access under src/lib/shopify.",
	},
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
	return PROJECT_TEMPLATES.find((template) => template.id === id);
}
