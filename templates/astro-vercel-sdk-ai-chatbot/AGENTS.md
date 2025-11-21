# AGENTS.md — Astro Vercel SDK AI Chatbot Template

This repository is an Astro 5 + React + Tailwind v4 template for building AI chat applications. It is designed so an AI agent (or human) can turn it into a production app with minimal changes.

Use this file as the primary source of truth when transforming the template.

## High‑Level Overview

- **Framework**: Astro 5 (React islands) + TypeScript
- **UI**: Tailwind CSS v4 (via `@import "tailwindcss"`) + custom prompt‑kit components
- **Chat logic**: Implemented in React in `src/components/Chatbot.tsx`
- **Mock backends**: All AI and data access is mocked in `src/mocks/` and can be swapped for real services
- **Entry page**: `src/pages/index.astro` renders the full‑screen chat interface

To create a real app, you mainly:
- Replace mocks in `src/mocks/` with real implementations
- Optionally add API routes (Astro endpoints) or integrate the Vercel AI SDK directly
- Adjust UI and theme via `src/components/` and `src/styles/global.css`

## Runtime & Commands

- Dev: `pnpm dev`
- Build: `pnpm build`
- Preview: `pnpm preview`

The project uses Astro’s default Node adapter unless overridden in `astro.config.mjs`.

## File & Folder Map

- `public/`
  - Static assets like `Astro Template.png`, `favicon.svg`. Served as‑is.

- `src/pages/index.astro`
  - Astro page that imports global styles and the React `Chatbot` island.
  - Sets `<html>` `<head>` meta tags and theme bootstrap script.
  - `<Chatbot client:load />` is the only main content.

- `src/components/Chatbot.tsx`
  - Main chat UI and stateful logic (conversation, history, attachments, provider/model selection).
  - Uses prompt‑kit components under `src/components/prompt-kit/` and primitive UI in `src/components/ui/`.
  - Currently wired to **mock** AI and data; see `src/mocks/` for details.

- `src/components/ThemeToggle.tsx`
  - React component to switch between light and dark themes.
  - Operates by toggling the `dark` class on `document.documentElement` and storing preference in `localStorage`.

- `src/components/prompt-kit/*`
  - Presentational chat primitives: container, messages, markdown rendering, input, code blocks, scroll button.
  - Designed to be data‑agnostic; they render whatever props `Chatbot` passes in.

- `src/components/ui/*`
  - Low‑level UI components (button, textarea, tooltip, avatar).
  - Tailwind‑styled, meant to be reusable across different pages.

- `src/lib/utils.ts`
  - General utilities, e.g. `cn` (class name merge) for Tailwind.

- `src/mocks/`
  - `ai-vercel-sdk.ts`: Mock implementation of AI chat generation, shaped similarly to Vercel AI SDK concepts.
  - `convex.ts` / `supabase.ts`: Example mocks for persistence/backends.
  - When turning the template into a real app, either:
    - Replace exports in these files with real implementations, **or**
    - Create real libraries (e.g. `src/lib/ai-service.ts`) and update imports in `Chatbot.tsx` and related components.

- `src/styles/global.css`
  - Tailwind v4 `@import` entry + plugin setup.
  - Defines CSS variables for light/dark themes (`--background`, `--foreground`, etc.) at `:root` and `.dark`.
  - Tailwind `@theme` section maps `--color-*` tokens used by utilities.

- `astro.config.mjs`
  - Astro configuration (integrations, React support, Tailwind plugin, etc.).

- `tsconfig.json`
  - TypeScript configuration; path aliases (e.g. `@/components/*`, `@/lib/*`, `@/mocks/*`). Keep paths consistent with this.

## How the Chat Flow Works

1. `src/pages/index.astro` imports `../styles/global.css` and the `Chatbot` component.
2. The `<Chatbot client:load />` island hydrates on the client and controls the entire UI.
3. Inside `Chatbot.tsx`:
   - Local React state tracks:
     - Current messages (`ConversationMessage[]`)
     - History groups (`HistoryGroup[]`)
     - Attachments and file previews
     - Selected provider/model (from a hard‑coded list in this file)
     - Sidebar open/closed state and other UI flags
   - Seed messages and history provide demo content.
   - On user input/submit, `Chatbot` currently calls **mocked** AI helpers to generate responses (see `src/mocks/ai-vercel-sdk.ts`).
   - Rendered UI delegates layout and styling to prompt‑kit components.

To integrate a real AI provider, you can:
- Keep the client‑side flow but replace the mock call with `fetch` to an Astro API route (e.g. `/api/chat`) that calls the Vercel AI SDK, OpenAI, Anthropic, etc.
- Or call the Vercel AI SDK directly from the client (if allowed) using environment variables exposed via Astro (not recommended for secret keys).

## Tailwind & Theming

- Tailwind v4 is activated via `@import "tailwindcss";` in `src/styles/global.css`.
- A custom `@custom-variant dark (&:is(.dark *));` creates `dark:` variants scoped to `.dark` on `html`.
- `:root` defines light theme colors; `.dark` overrides them.
- Body defaults to `background: var(--background); color: var(--foreground);` and uses `var(--font-sans)`.
- Components use standard Tailwind utility classes (e.g. `bg-background text-foreground`, etc.) that map to these CSS variables.

Theme preference is:
- Initially set by an inline script in `src/pages/index.astro` (reads `localStorage["theme"]` or `prefers-color-scheme`).
- Updated interactively by `ThemeToggle.tsx`.

## Using This As a Template (For Agents)

When an AI agent wants to convert this template into a fully wired app, follow this plan:

1. **Choose backend model strategy**
   - Option A: Server‑side AI routes using the **Vercel AI SDK** (recommended for production).
   - Option B: Direct provider SDK calls from the server (OpenAI, Anthropic, etc.).
   - Option C: Client‑only prototypes using a public endpoint.

2. **Create real backend modules**
   - Add a file such as `src/lib/ai-service.ts` that exports functions like:
     - `generateChat({ messages, provider, model, attachments })`
   - Implement inside using your chosen provider/SDK.
   - Use `process.env.*` variables from `.env` (Astro env loading) and never hard‑code secrets.

3. **Add API routes (if needed)**
   - In `src/pages/api/chat.ts` (or a similar route):
     - Parse incoming JSON body (`messages`, `provider`, `model`, `attachments`).
     - Call your `ai-service` functions.
     - Stream or return the response in the structure `Chatbot.tsx` expects.
   - Update `Chatbot.tsx` to call this endpoint with `fetch` instead of the mock.

4. **Replace mocks**
   - Option 1 (in‑place): Edit `src/mocks/ai-vercel-sdk.ts` and other mocks to call real services, keeping the same exported signatures.
   - Option 2 (new libs):
     - Create `src/lib/ai-service.ts`, `src/lib/storage.ts`, etc.
     - Update imports in `Chatbot.tsx` accordingly (e.g. replace `@/mocks/ai-vercel-sdk` with `@/lib/ai-service`).

5. **Wire conversation history persistence (optional)**
   - Decide a storage layer: database, Supabase, Convex, file‑based, etc.
   - Implement CRUD operations in a small library (e.g. `src/lib/history.ts`).
   - Replace any history mocks with calls into that library.

6. **Customize the UI**
   - Edit `src/components/prompt-kit/` for chat layout changes (bubble shape, spacing, typography).
   - Use `src/components/ui/` as the design system primitives.
   - Adjust colors and typography in `src/styles/global.css`.

7. **Add more pages (optional)**
   - Create new `.astro` files in `src/pages/` and import existing components as React islands.
   - Use hydration directives (`client:load`, `client:visible`, etc.) to control client execution.

## Conventions & Guidelines

- Prefer small, focused React components and helper functions (< ~20 lines where practical).
- Keep business logic either:
  - Inside `Chatbot.tsx` for simple apps, **or**
  - In dedicated libraries under `src/lib/` for larger apps.
- Keep `src/mocks/` mock‑only; when adding real behavior, consider mirroring the same function names in `src/lib/` and moving callers over.
- Do not store secrets in the frontend; rely on Astro server routes or environment variables.

## Safe Edits for Agents

Agents can usually do the following without breaking the template:

- Update or replace:
  - `src/components/Chatbot.tsx` (logic and wiring)
  - `src/mocks/*` (swap mocks for real services)
  - `src/styles/global.css` (colors, fonts, spacing)
  - Any component under `src/components/`
- Add:
  - New libraries under `src/lib/`
  - New API routes under `src/pages/api/*`
  - New pages under `src/pages/`

When in doubt, keep exports and prop types compatible so existing imports continue to work.

## Maintaining This File

- Treat `AGENTS.md` as executable documentation for agents.
- Whenever you change architecture, move files, or alter key flows (chat pipeline, theming, mocks vs real services), update the relevant bullets and sections here in the same commit.
- Prefer stable descriptions over implementation details that change frequently.
- If you add new domains, backends, or major features, add a short subsection explaining how agents should interact with them (where to plug in, what to avoid).