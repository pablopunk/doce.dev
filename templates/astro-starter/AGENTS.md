# AGENTS.md — Project Usage Guide

This file is copied into project roots to explain how to use and maintain the project. Review and update it when you make project-specific changes.

## Quick Start

- Install: `pnpm install`
- Dev: `pnpm dev` (local dev server)
- Build: `pnpm build`
- Preview: `pnpm preview`

## What this project is

- Astro 5 application (file-based routing; static pages with server islands for dynamic pieces)
- TypeScript-enabled
- Tailwind CSS v4 using a semantic token system (avoid `dark:` classes)
- React available via `@astrojs/react` for client interactivity
- shadcn/ui components included in `src/components/ui/`; `components.json` records CLI choices

## Typical file layout

- `src/pages/` — Routes (file-based)
- `src/layouts/` — Layout components to share chrome/meta
- `src/site.json` — Shared site metadata (name, description, URL, social)
- `src/components/` — Reusable `.astro` and `.tsx` components
- `src/actions/` — Astro Actions (server handlers)
- `src/lib/` — Helpers, DB wrappers, utilities
- `src/styles/` — Global CSS and Tailwind setup (semantic variables)
- Root: `package.json`, `.env.example`, `README.md`, `AGENTS.md`

## Pages & layouts

- `src/layouts/Layout.astro` is the canonical app shell; all pages should import and wrap content in this layout.
- `src/pages/index.astro` → `/` (starter landing page expected to be replaced by generators).
- Dynamic routes: `src/pages/blog/[slug].astro` → `/blog/:slug`
- Import a layout into pages to share header/footer/meta tags
- `src/styles/global.css` defines Tailwind v4 and the semantic color tokens used by shadcn/Tailwind utilities.

## Server-side: Astro Actions

- Use Astro Actions for non-streaming server operations.
- Place actions in `src/actions/*.ts` and export a `server` object.
- Actions are type-safe and can use Zod (`astro:schema`) for validation.
- Prefer calling `actions.<module>.<action>` from components instead of `fetch` for internal APIs.

Example:

```ts
// src/actions/example.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro/schema';

export const server = {
  doThing: defineAction({
    input: z.object({ id: z.string() }),
    handler: async ({ id }) => ({ success: true }),
  }),
};
```

## Server islands

- Use server islands for server-rendered pieces that need server-only data (auth, real-time snippets).
- In `.astro` pages: `<MyComp server:defer />` or `server:idle`.
- Server islands keep most pages static while enabling dynamic server-rendered components.

## React & hydration

- Put React components in `src/components/*.tsx`.
- Hydrate with `client:load`, `client:idle`, or `client:visible` on the component tag in `.astro` files.
- Do not use Next.js-specific `"use client"` directives in Astro.

## shadcn components & `components.json`

- shadcn/ui components are copied into `src/components/ui/` so you own the code.
- `components.json` (root of the project) records which shadcn components were added by the CLI.
- To add components: `pnpm dlx shadcn@latest add <component>` (this updates `components.json` and writes files into `src/components/ui/`).
- Prefer using provided shadcn components; wrap them in small domain components under `src/domain/` when behaviour differs.

Token mapping (shadcn → semantic classes):
- `bg-background` → `bg-bg`
- `bg-card` → `bg-surface`
- `bg-primary` → `bg-cta`
- `text-foreground` → `text-fg`
- `text-muted-foreground` → `text-muted`
- `border` / `border-input` → `border-border`

After adding components, scan generated files and replace tokens if needed to match the project's semantic variables.

## Tailwind & semantic variables

- Tailwind v4 is configured in `src/styles/` (global CSS). Use CSS variables for semantic colors and tokens that adapt between light/dark modes.
- Do not rely on `dark:` utility classes; prefer semantic classes like `bg-surface`, `text-fg`, `border-border`.

Example (conceptual):

```css
:root { --bg: /* light */; --fg: /* light */ }
.dark { --bg: /* dark */; --fg: /* dark */ }
/* Tailwind utility classes map to these tokens via your CSS or Tailwind config */
```

## Persistence

- If the project needs a database, a simple wrapper typically lives in `src/lib/db.ts`.
- Common choice: `better-sqlite3` for local, file-based persistence; adapt as needed.

## Environment variables

- Put secrets in `.env` (gitignored) and provide `.env.example` with placeholder values.
- Client-exposed vars must be prefixed with `PUBLIC_`.

## Scripts (recommended)

Scripts in `package.json` (template):

- `dev`: `astro dev --host 0.0.0.0 --port 3000` (local dev server; binds to 0.0.0.0 on port 3000)
- `build`: `astro build`
- `preview`: `astro preview`
- `astro`: `astro` (convenience wrapper for the CLI)
- `type-check`: `astro check`
- `format`: run Prettier (e.g. `prettier --write .`)

If you change these scripts in `package.json`, update this file accordingly.

## Testing & validation

- Run `pnpm type-check`, `pnpm lint`, and `pnpm build` before releasing.
- Update `AGENTS.md` and `README.md` to reflect project-specific deviations.

---

This file represents the current state of the project. When the project structure, configuration, or dependencies change, update this file to reflect those changes.

