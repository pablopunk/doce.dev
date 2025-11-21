# AGENTS.md — Storeplate Template

> This file is for humans and AI agents customizing this template. Keep it accurate as the codebase evolves.

## Scope & Purpose

- **Scope**: This `AGENTS.md` applies to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory. Subdirectory files override relevant parts of this root file within their own folder tree.
- **Goal**: Explain how the project is structured so an AI agent (or human) can **transform this template into a focused, production-ready project with a single prompt**.
- **Template mindset**: This repo is intentionally **large and feature‑rich**. For most real projects, you are expected to **strip features away** and simplify the codebase according to the requested use case.

## High‑Level Overview

- **Template name**: Storeplate — Astro + Shopify + Tailwind CSS + TypeScript.
- **Primary use case**: Modern Shopify storefront consuming the **Shopify Storefront API (GraphQL)**.
- **Tech stack**:
  - Astro 5 (file‑based routing, SSR/SSG)
  - React islands for interactive UI (cart, filters, sliders, etc.)
  - Tailwind CSS v4 + custom CSS modules
  - TypeScript throughout
  - Shopify Storefront API for products, collections, cart/checkout
- **Content**: Mixed model of **Shopify data + local Markdown content** (about, contact, legal pages, sections).
- **Deployment**: Generic Astro project; includes `config/nginx/nginx.conf` and `public/.htaccess` helpers for common hosting setups.

## How to Use This Repository as a Template

When an AI agent is instructed to “build X using this template”, follow this sequence:

1. **Understand requested scope**
   - Identify what the user actually needs:
     - Full Shopify store vs. catalogue only vs. static marketing site.
     - Which pages/routes are required (home, product listing, product detail, about, blog, auth, etc.).
     - Whether Shopify auth/cart/checkout flows are needed.

2. **Decide what to keep vs. remove**
   - This repo ships many features **by default** (filters, search, auth pages, hero slider, infinite scroll, etc.).
   - It is **safe and expected** to remove entire feature areas when not needed:
     - Unused pages under `src/pages/**` (e.g. `login.astro`, `sign-up.astro` if there is no auth).
     - Unused React components in `src/layouts/functional-components/**` (e.g. filters, sliders, testimonials) if the new design does not use them.
     - Unused content collections and markdown files in `src/content/**`.
     - Unused config fields in `src/config/*.json` (hero slider collections, social links, etc.).

3. **Prefer simplifying over adding new complexity**
   - When adapting, first **simplify** existing components/layouts instead of building new abstractions.
   - Reuse existing patterns for:
     - Layouts (`src/layouts/**`)
     - Card components, grids, and typography
     - Shopify data fetching via `src/lib/shopify/**`

4. **Update configuration instead of hard‑coding**
   - Storefront name, hero slider collections, featured collections, social links, theme options, etc. should be changed via:
     - `src/config/config.json`
     - `src/config/menu.json`
     - `src/config/social.json`
     - `src/config/theme.json`

5. **Keep environment assumptions simple**
   - Shopify settings and tokens are configured via `.env` (see `README.md` and `.env.example` in the original template). Do not hard‑code secrets.

6. **Update this `AGENTS.md` if you change architecture**
   - Whenever you:
     - Introduce a new top‑level feature (e.g. blog, wishlist, reviews)
     - Remove core features (e.g. Shopify integration, cart system)
     - Change routing conventions or directory layout
   - …you must update the relevant sections below so future agents have up‑to‑date guidance.

### Quickstart: Adapting to a New Project

Use this checklist when turning the template into a concrete project:

1. **Set up environment & Shopify**
   - Copy `.env.example` → `.env` and fill Shopify values from your partner dashboard (`storefront API token`, domain, etc.).
   - Optionally import demo products using `public/products.csv` into a development store.

2. **Configure store basics**
   - Edit `src/config/config.json`:
     - Store name, currency symbol/code.
     - Shopify collection handles for `hero_slider`, `featured_products`, and any other used collections.
   - Adjust hero slider collections per README instructions if needed.

3. **Update navigation & branding**
   - Edit `src/config/menu.json` to match the required pages and navigation structure.
   - Edit `src/config/social.json` for social profiles.
   - Edit `src/config/theme.json` for theme options (colors, layout toggles) instead of hard‑coding in components.
   - Replace branding assets in `public/` as needed:
     - Logos: `public/images/logo.png`, `public/images/logo-darkmode.png`.
     - Favicon/OG image: `public/images/favicon.png`, `public/images/og-image.png`.

4. **Update static content**
   - Edit markdown under `src/content/**` to match the new project:
     - `src/content/about/-index.md` — About page.
     - `src/content/contact/-index.md` — Contact page.
     - `src/content/pages/privacy-policy.md`, `terms-services.md` — Legal pages.
     - `src/content/sections/*.md` — Home sections (CTA, payments & delivery, etc.).

5. **Decide which pages/features to keep**
   - Review pages in `src/pages/**` and remove what is not needed:
     - Auth: `src/pages/login.astro`, `src/pages/sign-up.astro`.
     - Product catalogue: `src/pages/products/index.astro`, `src/pages/products/[slug].astro`.
     - Generic content: `src/pages/[regular].astro`.
   - When removing a page:
     - Delete the `.astro` file.
     - Remove corresponding links from `src/config/menu.json` and any header/footer components.

6. **Prune interactive components**
   - In `src/layouts/functional-components/**`, delete feature folders you don’t need (e.g. `filter/`, `cart/`, `rangeSlider/`, sliders, testimonials).
   - Clean up imports/usages in `src/layouts/**` and `src/pages/**` that referenced removed components.

7. **Customize layout & homepage**
   - Adjust `src/pages/index.astro` to compose the sections and components you want for the homepage.
   - Reuse `Base.astro` and partials from `src/layouts/partials/**` rather than creating new layout shells.

8. **Optional: Run without Shopify**
   - For prototypes or static catalogues, you can:
     - Stub or mock functions in `src/lib/shopify/index.ts`.
     - Replace product/page data with static data or another data source.
     - Remove any pages/features that require live cart/checkout.

## Project Layout

Top‑level folders and their roles:

- `config/`
  - `nginx/nginx.conf`: Example Nginx configuration for deployment. Not required for local dev but useful as a reference.
- `public/`
  - Static assets served as‑is: images, favicon, Open Graph image, payment logos, staff images, `robots.txt`, `.htaccess`, and `products.csv` (example product data for Shopify import).
- `scripts/`
  - `removeDarkmode.js`: Helper script related to dark‑mode handling in production (e.g. cleaning legacy classes). If you drastically change theming, revisit or remove this.
- `src/`
  - **See architecture sections below.** This is where almost all application code lives.
- Config files at root:
  - `astro.config.mjs`: Astro project configuration.
  - `tsconfig.json`: TypeScript configuration.
  - `.editorconfig`, `.prettierrc`, `.markdownlint.json`: Formatting rules.
  - `netlify.toml`: Netlify‑oriented deployment config (can be removed if unused).
  - `package.json`: Scripts and dependencies.

## Application Architecture (src/)

### Config (`src/config`)

- `config.json`
  - Global storefront configuration:
    - Currency symbol/code
    - Shopify collection handles (e.g. hero slider, featured products)
    - Misc. display settings
- `menu.json`
  - Navigation structure for header/footer menus.
- `social.json`
  - Social media links and related metadata.
- `theme.json`
  - Theme‑level settings (colors, typography tokens, layout toggles, etc.).

> When customizing the brand or layout, **prefer editing these config files** instead of scattering values through components.

### Content System (`src/content` + `content.config.ts` + `src/types`)

- `content.config.ts`
  - Astro content collections configuration. Defines frontmatter schemas and collection types.
- Collections:
  - `content/about/-index.md`
  - `content/contact/-index.md`
  - `content/pages/*.md` (e.g. privacy policy, terms of service)
  - `content/sections/*.md` (e.g. call‑to‑action, payments & delivery)
- Types under `src/types/**`
  - Strongly typed representations of content collections (about, contact, CTA section, payment section, etc.).

**Usage pattern**
- Static site content (marketing copy, legal pages, sections) should live in markdown + frontmatter, not hard‑coded in components.
- React/Astro components should read from these collections via Astro’s content APIs and strongly typed helpers.

### Layouts (`src/layouts`)

- `Base.astro`
  - The primary layout, usually wrapping all pages. Handles global `<head>` configuration, header/footer, and shared wrappers.
- `layouts/components/`
  - Reusable Astro components used inside layouts and pages:
    - `Breadcrumbs.astro`, `FeaturedProducts.astro`, `Logo.astro`, `Pagination.astro`, etc.
- `layouts/partials/`
  - Page sections shared between different views:
    - `Header.astro`, `Footer.astro`, `PageHeader.astro`, `Testimonials.astro`, etc.
- `layouts/helpers/`
  - Shared TSX helpers for layout‑level elements (e.g. `Announcement.tsx`, `DynamicIcon.tsx`).

When building new pages, **reuse `Base.astro` and these partials** instead of duplicating markup.

### React Islands & Functional Components (`src/layouts/functional-components`)

- Organized by feature domain:
  - `cart/`: Cart modal, add/edit/delete item buttons, cart icon + drawer.
  - `filter/`: Dropdown filters, filter items for product listings.
  - `loadings/`: Skeletons and loading indicators.
  - `product/`: Payment slider, product gallery, tabs, tags, layout variants.
  - `rangeSlider/`: Range slider component (e.g. for price filter) and CSS.
  - Other interactive UI: hero/collections sliders, search bar, signup forms, testimonials, product grid/list/toggle views, etc.

**Guidance for agents**
- These components are meant to be **plug‑and‑play interactive islands** hydrated from Astro pages using `client:*` directives.
- It is safe to **delete entire folders** if the corresponding feature is not needed (e.g. no filters → remove `filter/` and any usage imports).
- When adding new interactivity, follow existing patterns:
  - Keep UI logic in TSX components under `functional-components/`.
  - Keep layout wrappers in `.astro` files.

### Shopify Integration (`src/lib/shopify`)

- `index.ts`
  - Entry point for all Shopify operations. Exposes functions that other parts of the app call instead of manually constructing GraphQL requests.
- `fragments/`
  - GraphQL fragments for reusable pieces (products, images, cart, SEO).
- `queries/`
  - GraphQL queries for cart, collection, menu, page, product, and related data.
- `mutations/`
  - GraphQL mutations for cart and customer actions.
- `types.ts`
  - TypeScript types mirroring Shopify’s GraphQL responses.

**Usage pattern**
- Astro and React components should **only talk to Shopify through this layer**.
- If you change Shopify schemas or response shapes, update:
  - `types.ts`
  - Relevant fragments/queries/mutations
  - Any call sites that rely on changed fields

If a future project replaces Shopify (e.g., static JSON, another headless CMS), this directory is the **main abstraction point** to swap implementations while keeping the rest of the app stable.

### Utilities (`src/lib/utils` and others)

- `src/lib/utils/**`
  - Helper utilities for background images, cart actions, date formatting, reading time, similar items, sort functions, taxonomy filters, text conversion, etc.
- `src/constants.ts`
  - Shared constants across the app (e.g. defaults, magic strings).
- `src/typeGuards.ts`, `src/utils.ts`
  - Generic helpers and type guards.
- `src/cartStore.ts`
  - Centralized cart state/store for client‑side interactions.

When extending behavior (e.g. new sort type, new tag filter), **prefer updating these utilities** instead of re‑implementing similar logic in multiple components.

### Pages & Routing (`src/pages`)

- Standard Astro file‑based routing:
  - `index.astro` — Homepage.
  - `about.astro`, `contact.astro` — Static pages powered by markdown content.
  - `login.astro`, `sign-up.astro` — Auth‑related pages.
  - `404.astro` — Custom error page.
  - `products/index.astro` — Product listing page (search, filters, pagination, etc.).
  - `products/[slug].astro` — Product detail page pulled from Shopify.
  - `[regular].astro` — Catch‑all for other static content pages.
- API routes under `pages/api/`:
  - `login.ts`, `sign-up.ts` — Auth flows.
  - `products.json.ts` — JSON endpoint for product data.

**Guidance for agents**
- To remove a page from the final project, you must:
  - Delete the corresponding `.astro` file under `src/pages`.
  - Clean up any navigation links in `src/config/menu.json` and header/footer components.
- To add a page, create a `.astro` file under `src/pages` and wrap its content in `Base.astro`.

### Styling (`src/styles` + Tailwind plugins)

- CSS entrypoints:
  - `main.css`, `base.css`, `buttons.css`, `components.css`, `navigation.css`, `safe.css`, `search.css`, `utilities.css`.
- Tailwind integration:
  - Tailwind utilities and design tokens are defined via these CSS files and Tailwind plugins under `src/tailwind-plugin/`.
  - `tailwind-plugin/tw-bs-grid.js`, `tailwind-plugin/tw-theme.js` extend Tailwind with layout and theme helpers.

**Theming**
- Light/dark mode and visual tokens are implemented via Tailwind and custom CSS variables plus components like `ThemeSwitcher.astro` and `ThemeSwitcher`‑related JS.
- When changing the design system, modify:
  - Theme tokens in CSS and `tw-theme.js`.
  - Config in `src/config/theme.json`.
  - Only then adjust components as necessary.

## Environment & Shopify Setup (Summary)

See `README.md` for full Shopify setup instructions. Key points for agents:

- To run with live data, the environment needs:
  - Shopify Storefront API domain and access token(s).
  - Values from Shopify partner dashboard configured in `.env`.
- Demo products can be imported using the `public/products.csv` file into a development store.
- The hero slider and featured collections are controlled via `src/config/config.json` collection handles.

When building a new project on top of this template, you may:
- Keep Shopify fully wired and just point it at a new store.
- Or, for prototypes, **mock or stub** Shopify calls in `src/lib/shopify` to run without live credentials.

## Maintaining This File

To keep `AGENTS.md` useful for future agents:

1. **Update on structural changes**
   - When you:
     - Add/remove top‑level directories under `src/` or project root.
     - Introduce or remove major features (Shopify integration, cart, filters, auth, hero slider, etc.).
     - Change routing conventions (`src/pages/**`) or where key configs live.
   - …update or add the corresponding sections here.

2. **Prefer referencing files over listing details**
   - Avoid hard‑coding fragile details (e.g., “there are exactly 10 pages”).
   - Instead, reference source files using `@src/path/to/file.ext` notation in prose when helpful.

3. **Document new domains/features**
   - If you add a new feature domain (e.g. wishlist, blog, reviews), briefly document:
     - Where its models/data live.
     - Which pages/components render it.
     - How it interacts with Shopify or local content.

4. **Use sub‑AGENTS for local rules when needed**
   - If a subdirectory needs special conventions (e.g. a different UI library, a separate micro‑feature), create `AGENTS.md` inside that folder describing local rules.
   - Clarify that those rules apply only to that directory tree and override conflicting instructions from this root file.

5. **Keep instructions aligned with actual code**
   - Whenever you refactor, check whether this file still matches reality.
   - If you’re in doubt, open this file and skim sections related to the code you’re touching.

By keeping this `AGENTS.md` accurate and high‑level, you ensure future AI agents can reliably transform this repo—from a full‑featured Shopify storefront template into a minimal, focused project—using a single prompt.