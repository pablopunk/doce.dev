# AGENTS.md — Flowbite Astro Admin Dashboard Template

> This repository is a **starter template** meant to be cloned, stripped down, and reshaped by humans and AI agents into many different apps (SaaS dashboards, internal tools, CRUD back‑offices, etc.). Keep this file up to date when you change architecture or behaviors so agents can safely automate refactors.

---

## 1. High‑level Overview

- **Stack**: Astro • TypeScript • Tailwind CSS v4 • Flowbite component library
- **Primary use‑case**: Admin/dashboard UI with authentication, CRUD, charts, tables, modals, drawers, etc.
- **Template philosophy**:
  - Ship a **maximal, feature‑rich** example app.
  - Expect humans/agents to **delete what they don’t need** per project.
  - Prefer **composition and reuse** over copy‑pasted markup.

When adapting this template, it is completely valid to:

- Remove whole sections (eg. auth pages, CRUD modules, playground) if not needed.
- Replace data sources (JSON → REST/GraphQL/DB).
- Swap branding, color palette, typography, layout structure.

Agents should treat this repo as a **toolbox**, not a final product.

---

## 2. Project Structure (Conceptual)

This structure is intentionally generic and can be repurposed for most dashboard‑like apps.

- `data/`
  - Static JSON used as **mock data** for the CRUD pages and dashboard widgets.
  - Safe to replace with dynamic backends or delete once you wire real APIs.

- `src/app/`
  - **Layout‑level Astro components** used across many pages.
  - Examples: `LayoutSidebar.astro`, `LayoutStacked.astro`, navigation bars, sidebars, footers.
  - When building a new app, reuse or fork these to define your main shell (sidebar vs top nav, etc.).

- `src/assets/`
  - Logos and static images (Astro, Flowbite branding, etc.).
  - Replace freely for your own brand.

- `src/components/`
  - Small, mostly atomic or low‑level UI components (toggles, inputs, utility widgets).
  - Good extraction target when you see duplicated markup in modules or pages.

- `src/lib/`
  - Generic utilities and data helpers.
  - `src/lib/data.ts` currently reads from `data/*.json` and adapts shapes for the UI.
  - When wiring a real backend, you can:
    - Replace these helpers with API/DB calls, or
    - Introduce a richer service/model layer and keep `lib` as infrastructure utilities.

- `src/modules/`
  - **Feature‑level building blocks** for larger pages.
  - Each file is usually a relatively complex piece of UI (eg. dashboards, CRUD tables, forms, error pages).
  - Intended to be composed into final pages in `src/pages/`.

- `src/pages/`
  - Astro file‑based routing.
  - Mirrors the demo pages of the original Flowbite admin dashboard:
    - `/dashboard`, `/settings`, `/crud/products`, `/crud/users`, auth flows under `/authentication/*`, etc.
  - API routes live under `src/pages/api/`.
  - When trimming the template for a new project, **removing pages is the main way to reduce scope**.

- `src/services/`
  - Thin service layer that centralizes CRUD logic.
  - Currently uses `data/*.json` + `src/lib/data.ts` as backing store.
  - You can evolve this into a **real API/DB adapter layer** without touching UI components.

- `src/types/`
  - Shared type definitions for entities (products, users, etc.).
  - Keep this file authoritative when changing data models.

- Root config files
  - `astro.config.mjs` — Astro project configuration.
  - `tailwind.config.cjs` — Tailwind + Flowbite plugin configuration.
  - `.eslintrc.cjs`, `.prettierrc.cjs`, `tsconfig.json` — linting, formatting, TS settings.

---

## 3. How Pages, Modules, Services, and Data Fit Together

This template is intentionally simple (no heavy domain layering) but still structured enough for larger apps.

**Flow of data (default implementation):**

1. `src/pages/**/*.astro` renders a route (eg. `/crud/products`).
2. The page imports one or more **modules** from `src/modules/` (eg. `CrudProducts.astro`).
3. The module calls functions from `src/services/*.ts` to read/write data.
4. Services call `src/lib/data.ts`, which currently work against JSON files under `data/`.
5. UI components in `src/components/` are used inside modules and layouts to keep markup DRY.

When porting to a “real app”:

- Replace or extend `src/services/*.ts` and `src/lib/data.ts` to hit your API, database, or external services.
- Keep the same public function signatures where possible to minimize changes in modules.
- Or, if building something very small, you can drop services and call APIs directly from pages/modules.

---

## 4. Using Flowbite Components in This Template

This project uses **Flowbite** for interactive Tailwind components (modals, navbars, drawers, dropdowns, tooltips, etc.). 

Key points from the official docs (https://flowbite.com/docs/getting-started/introduction/):

- Flowbite is a Tailwind CSS component library; you compose UIs from **Tailwind utility classes** plus a small **JavaScript runtime** for interactive parts.
- Interactive components are wired via **data attributes** in markup (`data-modal-toggle`, `data-dropdown-toggle`, etc.).
- Flowbite JS can be included via:
  - NPM (`npm install flowbite`, then `import 'flowbite'`) or
  - CDN scripts for `flowbite.min.css` and `flowbite.min.js`.

In this template:

- Tailwind and Flowbite are preconfigured in `tailwind.config.cjs` and the main CSS entry.
- Flowbite components are primarily used **directly in `.astro` files** with Tailwind classes and data attributes copied or adapted from the official docs.

**When adding new Flowbite components:**

- Go to the relevant Flowbite docs page (eg. navbar, sidebar, modal, table, alert).
- Copy the example markup and:
  - Replace `<div>`/`<button>` attributes with your own text, links, and icons.
  - Preserve required `data-*` attributes and IDs used for toggling.
- Prefer wrapping complex chunks into:
  - A **layout component** in `src/app/` (eg. a new sidebar layout), or
  - A **module** in `src/modules/` if it’s page‑level logic, or
  - A **small reusable component** in `src/components/` if it will be reused across multiple modules.

**When using Flowbite JS API programmatically (advanced):**

- You can import classes like `Modal` from `flowbite` and instantiate them in client‑side scripts.
- Default pattern from docs:
  - `import { Modal } from 'flowbite';`
  - `const modal = new Modal($modalElement, modalOptions);`
- This is rarely needed for simple dashboard flows because the **data‑attribute interface** already covers most use‑cases.

Agents modifying Flowbite usage should **always consult the official docs** for the latest markup and JS API: https://flowbite.com/docs/getting-started/introduction/ and the component‑specific pages.

---

## 5. Stripping the Template Down for a New Project

This repo is intentionally **large**. A typical AI or human customization flow should be:

1. **Decide the product type**
   - SaaS admin dashboard, analytics panel, internal tool, CRUD back‑office, simple marketing site + app, etc.

2. **Prune pages**
   - Remove any routes you don’t need from `src/pages/`:
     - Example: delete `/authentication/*` if you will integrate a 3rd‑party auth provider.
     - Example: delete `/crud/products` and `/crud/users` if your app does not manage those entities.

3. **Prune modules**
   - Any module under `src/modules/` that is only used by a removed page can be safely deleted.
   - Keep or refactor modules that are close to your domain (eg. rename `CrudProducts` to `CrudSubscriptions`).

4. **Adapt data and types**
   - Update `src/types/entities.ts` with your real data model.
   - Adjust `src/lib/data.ts` and `src/services/*.ts` to match new types and data sources.

5. **Update navigation and layouts**
   - Edit `src/app/NavBarSidebar.astro`, `SideBar.astro`, and related layout components to reflect your final routes.
   - Remove links to deleted pages.

6. **Remove unused assets and utilities**
   - Delete logos, images, or helper functions you no longer use from `src/assets/` and `src/lib/`.

Agents should prefer **deletion and simplification** over leaving unused demos in place, unless the goal is explicitly to keep a library of examples.

---

## 6. Conventions for AI Agents Making Changes

When you (an AI agent) modify this template, aim for **predictable, mechanical transformations** that humans and other agents can understand:

- Prefer **small, composable components** in `src/components/` when extracting repeated markup.
- Keep **file names descriptive and domain‑oriented** (eg. `BillingSettings.astro` instead of `Page1.astro`).
- When changing data structures:
  - First update `src/types/entities.ts`.
  - Then update services in `src/services/` and helpers in `src/lib/`.
  - Finally update modules and pages that consume those types.
- For new features, follow the existing layering:
  - Route in `src/pages/...`
  - Feature UI module in `src/modules/...`
  - Optional reusable pieces in `src/components/...`
  - Data access in `src/services/...` (and `src/lib/...` if needed).

---

## 7. Keeping This AGENTS.md Up to Date

This file is the **primary contract** between the codebase and AI agents.

**Rules for updating AGENTS.md:**

- Whenever you change **architecture, data flow, or directory purposes**, update this file in the same PR/commit.
- If you:
  - Add a new directory with a specific role (eg. `src/domain/`),
  - Change how data is fetched (eg. move from JSON to REST or DB),
  - Introduce a new core dependency or pattern (state management, routing, auth provider),
  - Significantly change how Flowbite is integrated,
  then **reflect that here**.
- Keep descriptions **conceptual and stable**:
  - Avoid listing exact file counts or exhaustive enumerations that will quickly go stale.
  - Instead, describe patterns and responsibilities, and reference example files with paths (eg. `src/modules/DashBoard.astro`).
- If you deprecate a pattern (eg. you stop using `src/services/` in favor of another layer), clearly mark which pattern is **preferred going forward**.

Suggested checklist for any substantial change:

1. Does this change add/remove/repurpose a folder? If yes, describe its new role.
2. Does this change alter how data flows from backend → UI? If yes, update section 3.
3. Does this change introduce or remove a major dependency (eg. Flowbite config, charting lib)? If yes, add a note.
4. After editing, skim this file from top to bottom and fix any now‑incorrect statements.

This is not marketing material; it is a **living spec for agents**. Prioritize clarity, correctness, and brevity over completeness.

---

## 8. Quick Start for Agents

- To build a **minimal SaaS dashboard**:
  - Keep `src/app` layouts, a subset of `src/modules` (dashboard + one CRUD), and associated pages.
  - Replace mock data and services with your real API.
  - Simplify navigation to only the routes you need.

- To build a **generic admin panel**:
  - Use CRUD modules (`CrudProducts`, `CrudUsers`) as blueprints for new entities.
  - Duplicate and rename them, updating types and services.

- To build a **read‑only analytics dashboard**:
  - Keep dashboard modules and data fetching.
  - Remove CRUD routes, services, and actions.

In all cases, treat Flowbite docs as the authoritative source for component behavior and markup, and treat this AGENTS.md as the authoritative source for how this particular template is wired together.