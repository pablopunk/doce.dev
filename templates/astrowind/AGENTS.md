# AGENTS.md — Astrowind Template

This file documents how the `templates/astrowind` project is structured and how AI agents (and humans) should modify it when turning this template into a concrete site (landing page, marketing site, portfolio, blog, etc.).

This `AGENTS.md` applies to everything under `templates/astrowind/`.

---

## Purpose & Philosophy

- This project is a **feature‑rich starter**: multiple home pages, blog, marketing sections, and CMS wiring.
- Real projects will almost always use **only a subset** of what exists here.
- When customizing for a user:
  - **Start from this template**, then
  - **Strip away all unused pages, components, and content**, and
  - **Refine or add only what the user actually needs**.
- Suitable end results include (but are not limited to):
  - Simple landing page for a product or SaaS
  - Marketing site with a few sections
  - Personal/portfolio site
  - Blog or documentation‑style content site

Always bias toward **deleting unused sample functionality** instead of leaving dead routes, components, or demo content in the final project.

---

## Stack Overview

- **Astro** for routing, layouts, and rendering.
- **TypeScript** for type‑safe config and utilities.
- **Tailwind CSS** for styling (see `tailwind.config.js` and `src/assets/styles/tailwind.css`).
- **Markdown/MDX** content for blog posts and demo pages in `src/data/post/`.
- Optional deployment/platform configs: `netlify.toml`, `vercel.json`, `nginx/nginx.conf`, `public/decapcms`.

You can safely delete platform‑specific config files that are not relevant to the target deployment.

---

## High‑Level Architecture

### Routing & Pages (`src/pages`)

- Astro file‑system routing is used.
- Key locations:
  - `src/pages/index.astro` — Primary entry page. For most projects this should become the **main landing page**.
  - `src/pages/homes/*.astro` — Alternative home pages (mobile app, personal, SaaS, startup). These are **examples**; pick one as a starting point or delete them if unused.
  - `src/pages/landing/*.astro` — Specialized landing patterns (click‑through, lead generation, product, sales, subscription, pre‑launch). All are **optional templates**.
  - `src/pages/[...blog]/**` — Blog listing, categories, tags, and single post routes. The entire blog subsystem is **optional**.
  - Other top‑level pages: `about.astro`, `contact.astro`, `pricing.astro`, `services.astro`, `404.astro`, legal pages (`privacy.md`, `terms.md`). Keep only those that match the requested site.
  - `src/pages/rss.xml.ts` — RSS feed for the blog. Safe to remove if the blog is not needed.

When simplifying the template for a specific project, it is normal to:
- Keep `index.astro` and only a small set of core pages.
- Delete unused `homes/`, `landing/`, `blog/`, and legal/auxiliary pages that are not required.

### Layouts (`src/layouts`)

- `Layout.astro` / `PageLayout.astro` / `LandingLayout.astro` / `MarkdownLayout.astro` define shared shells (header, footer, meta, structure).
- Pages should use the most appropriate layout. If a project only needs one layout, you can:
  - Standardize on a single layout (e.g., `PageLayout.astro`).
  - Delete unused layout files once no pages import them.

### Components (`src/components`)

Organized by role:

- `src/components/widgets/` — Larger page sections and marketing blocks (hero, pricing, testimonials, features, FAQs, contact, footer, header, etc.).
  - These are **composable building blocks** for landing pages and marketing sites.
  - You can delete any widget that is not used by remaining pages.
- `src/components/ui/` — Smaller, more generic UI components (forms, timelines, grids, etc.).
  - Prefer reusing these over duplicating markup.
  - Safe to delete unused components once nothing imports them.
- `src/components/blog/` — Blog‑specific components (list, grid, pagination, tags, single post view, related posts, etc.).
  - If the final project has **no blog**, remove:
    - `src/components/blog/`
    - `src/pages/[...blog]/`
    - `src/data/post/`
    - Blog utilities from `src/utils/blog.ts` (and any other references to blog helpers).
    - `src/pages/rss.xml.ts`.
- `src/components/common/` — Cross‑cutting components: metadata, favicons, social sharing, analytics, theme toggles, etc.
  - Be careful when removing these: pages and layouts may depend on them for SEO, meta tags, or analytics.

### Assets & Styles (`src/assets`)

- `src/assets/styles/tailwind.css` — Tailwind base/style imports and any global styles.
- `src/assets/images/` — Image assets used by hero sections, app store badges, etc.
- `src/assets/favicons/` — Favicon and touch icons, usually wired into `Favicons.astro` and meta components.

When customizing branding:
- Replace or add images, logos, and icons here.
- Update any components that reference old image paths.

### Content & Data (`src/content`, `src/data`)

- `src/content/config.ts` — Astro content collections configuration.
- `src/data/post/` — Markdown/MDX demo posts powering the blog.
  - Replace these with real posts or delete the folder if no blog is needed.

### Utilities & Config (`src/utils`, root configs)

- `src/utils/*.ts` — Various helper utilities (blog helpers, frontmatter, permalinks, image utilities, etc.).
  - Only keep utilities that are still referenced; remove others alongside the features that require them.
- `src/navigation.ts` — Central navigation definition for header/footer.
  - Keep this consistent with the final set of pages.
- `src/config.yaml` — High‑level site configuration (title, description, social links, etc.). Update this to reflect the new project.

Root configuration files:
- `astro.config.ts` — Astro project configuration. Required.
- `tailwind.config.js` — Tailwind configuration. Required if Tailwind is used.
- `tsconfig.json`, `eslint.config.js`, `.editorconfig`, `.prettierrc.cjs` — Tooling configuration. Usually kept as is.
- `netlify.toml`, `vercel.json`, `nginx/nginx.conf`, `public/decapcms/*` — Platform/CMS specific. Safe to delete if not applicable.

### Public Files (`public`)

- `public/robots.txt`, `public/_headers`, and others are deployment related.
- Update or remove based on hosting platform and SEO requirements.

---

## Common Transformation Scenarios

When an agent receives a high‑level request (e.g., “single‑page SaaS landing”, “portfolio site with projects”, “simple marketing site + blog”), follow these patterns.

### 1) Single‑Page Landing (Most Common)

- Keep:
  - `src/pages/index.astro` (convert to the main landing page).
  - A minimal set of sections from `src/components/widgets/` (e.g., `Hero.astro`, `Features.astro`, `Pricing.astro`, `CallToAction.astro`, `Testimonials.astro`, `Footer.astro`, `Header.astro`).
  - At least one layout (e.g., `LandingLayout.astro` or `PageLayout.astro`).
- Remove:
  - `src/pages/homes/` and `src/pages/landing/` (after copying any patterns you actually use into `index.astro`).
  - Blog routes, blog components, posts, and RSS feed if not requested.
  - Extra standalone pages like `about.astro`, `pricing.astro`, `services.astro` if the spec says “just one page”.
- Update:
  - `src/navigation.ts` to only include links that still exist.
  - `src/config.yaml` and meta components for the correct branding and SEO text.

### 2) Portfolio / Personal Site

- Keep:
  - `src/pages/index.astro` as the main profile/portfolio landing.
  - Additional pages like `about.astro`, `contact.astro`, maybe a `projects` page (create a new one if needed).
  - Widgets that showcase work, testimonials, or contact forms.
- Optional:
  - Blog subsystem if the user wants articles.
- Remove:
  - SaaS/product‑specific templates and landing variants not used by the portfolio.

### 3) Marketing Site + Blog

- Keep:
  - `index.astro` and any relevant marketing pages (`pricing.astro`, `about.astro`, `contact.astro`, etc.).
  - Blog subsystem: `src/pages/[...blog]/`, `src/components/blog/`, `src/data/post/`, `src/pages/rss.xml.ts`.
- Update:
  - Replace demo posts with real content.
  - Ensure navigation includes a “Blog” link pointing at the appropriate blog index.

In every case, the **final project should not include unused routes, components, assets, or platform configs**.

---

## Agent Workflow Guidelines

When transforming this template into a concrete project:

1. **Understand the request**
   - Identify required pages, sections, and features.
   - Clarify whether a blog, contact forms, pricing tables, or legal pages are needed.

2. **Select or design the main layout**
   - Choose one main layout (`LandingLayout.astro` or `PageLayout.astro`) and use it consistently.
   - Optionally remove alternative layouts once unused.

3. **Assemble pages from widgets**
   - Compose `index.astro` and other pages using widgets under `src/components/widgets/` and UI components from `src/components/ui/`.
   - Prefer reusing existing building blocks over writing new markup from scratch.

4. **Strip unused features**
   - Delete entire directories and files for features that are definitively not needed (e.g., blog, extra landings, CMS configs, deployment configs).
   - Remove their imports/usages from layouts, pages, utilities, and navigation.

5. **Adapt styling & content**
   - Update copy, headings, and images to match the brand.
   - Keep styling within the existing Tailwind setup unless explicitly asked to change it.

6. **Keep navigation and metadata accurate**
   - Ensure `src/navigation.ts` matches the actual set of pages.
   - Update meta components (`src/components/common/*.astro`) and `src/config.yaml` for title, description, and social data.

7. **Validate**
   - Make sure there are no broken imports or dead routes.
   - Run the dev server (`pnpm install && pnpm run dev`) and verify pages load as expected.

---

## Keeping This File Up to Date

Whenever you (human or agent) make non‑trivial structural changes under `templates/astrowind/`, you must treat this file as **documentation of record** and update it accordingly.

Update this `AGENTS.md` when you:
- Add or remove major directories under `src/` (e.g., new feature folders, removal of the blog, new content collections).
- Introduce a new type of page or layout pattern that other agents should know about.
- Change how navigation, configuration, or metadata are organized (e.g., moving `navigation.ts`, replacing `config.yaml`).
- Remove or replace any external integration that is specifically mentioned here (Netlify, Vercel, Decap CMS, etc.).

When editing this file:
- **Do not rely on fragile counts or lists** that go out of date easily (e.g., “there are 5 widgets”); instead, reference stable paths like `src/components/widgets/` and describe their purpose.
- Keep descriptions **high‑level but actionable**: enough for another agent to know where to look and what is safe to delete or reuse.
- Ensure that any **newly important files or patterns** are mentioned (e.g., if you add a `src/components/sections/` folder, document it).
- If you fully remove a subsystem (e.g., blog), also remove or rewrite any sections of this file that reference it, so future agents are not misled.

This file should always reflect the **current architecture and intended usage** of the Astrowind template as a flexible, strip‑down‑to‑fit starter for many kinds of small marketing, portfolio, and content sites.