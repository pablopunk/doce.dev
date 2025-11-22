# Global Rules for AI-Generated Projects

This file contains framework-independent rules and guidelines that apply to ALL generated projects, regardless of the design system or specific template used.

## Package Manager

- **Always use pnpm** (not npm or yarn)
- Command examples:
  - Install: `pnpm install`
  - Add dependency: `pnpm add <package>`
  - Dev dependency: `pnpm add -D <package>`
  - Run script: `pnpm run <script>` or `pnpm <script>`

## Framework & Stack

- **Framework**: Astro 5 (file-based routing, static by default)
- **Styling**: Tailwind CSS v4 (utility-first, no dark: classes, semantic color system)
- **TypeScript**: Required for all projects
- **Node version**: >=20.0.0
- **pnpm version**: >=10.0.0

## Styling Guidelines

### Tailwind CSS v4

- **Installation**: Use `@tailwindcss/vite` plugin in `astro.config.mjs`
- **Configuration**: Define theme variables using `@theme` directive (not `:root`)
- **NO `dark:` classes**: Use semantic color variables that adapt automatically
- **Theme variables**: See https://tailwindcss.com/docs/theme for complete reference

### Semantic Color System

Instead of `dark:bg-gray-800`, use semantic variables:

```css
@import "tailwindcss";

@theme {
  --color-bg: oklch(0.98 0 0);           /* page background */
  --color-surface: oklch(1 0 0);         /* cards, panels */
  --color-raised: oklch(0.95 0 0);       /* elevated surfaces */
  --color-cta: oklch(0.14 0 0);          /* primary buttons (inverted) */
  
  --color-text-strong: oklch(0.14 0 0);  /* headings */
  --color-text-fg: oklch(0.3 0 0);       /* body text */
  --color-text-muted: oklch(0.5 0 0);    /* secondary text */
  
  --color-border: oklch(0.9 0 0);        /* standard borders */
}

.dark {
  --color-bg: oklch(0.14 0 0);
  --color-surface: oklch(0.18 0 0);
  --color-raised: oklch(0.22 0 0);
  --color-cta: oklch(0.98 0 0);
  
  --color-text-strong: oklch(0.98 0 0);
  --color-text-fg: oklch(0.85 0 0);
  --color-text-muted: oklch(0.65 0 0);
  
  --color-border: oklch(0.3 0 0);
}
```

Then use in HTML:
```html
<div class="bg-surface text-fg border border-border">
  <h1 class="text-strong">Heading</h1>
  <p class="text-muted">Secondary text</p>
</div>
```

## Server-Side Functionality

### Astro Actions

- **Use for all server operations** (NOT API routes unless streaming is required)
- **Location**: `src/actions/*.ts`
- **Type-safe**: Full TypeScript from server to client
- **Validated**: Automatic Zod validation on inputs
- **Docs**: https://docs.astro.build/en/guides/actions/

Example:
```typescript
// src/actions/todo.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';

export const server = {
  addTodo: defineAction({
    input: z.object({
      title: z.string(),
      completed: z.boolean().default(false),
    }),
    handler: async ({ title, completed }) => {
      // Database logic here
      return { id: 1, title, completed };
    },
  }),
};
```

### Server Islands (for SSR components)

- **Use for dynamic, server-rendered components** (auth status, real-time data)
- **Syntax**: `<MyComponent server:defer />` in `.astro` files
- **Docs**: https://docs.astro.build/en/guides/server-islands/

## Data Persistence

### Plain SQLite (Preferred)

When persistence is needed:

- **Use better-sqlite3**: `pnpm add better-sqlite3 @types/better-sqlite3`
- **Location**: `src/lib/db.ts` (create a simple wrapper)
- **Migrations**: Keep SQL files in `src/lib/db/migrations/`
- **NO ORM**: Use plain SQL queries for simplicity

Example:
```typescript
// src/lib/db.ts
import Database from 'better-sqlite3';

const db = new Database('./data/app.db');

export function getTodos() {
  return db.prepare('SELECT * FROM todos').all();
}

export function addTodo(title: string) {
  return db.prepare('INSERT INTO todos (title) VALUES (?)').run(title);
}
```

### localStorage (Client-side only)

- For simple, non-critical data (preferences, UI state)
- Always check `typeof window !== 'undefined'` before using

## React Integration (when needed)

- **Installation**: `pnpm add react react-dom @types/react @types/react-dom`
- **Astro config**: Add `@astrojs/react` integration
- **Hydration**: Use `client:load`, `client:idle`, or `client:visible` directives
- **NO `"use client"` directive**: That's Next.js syntax, not needed in Astro

## File Structure

```
src/
├── actions/           # Astro Actions (server functions)
├── components/        # Reusable UI components (.astro or .tsx)
├── layouts/           # Page layouts
├── pages/             # File-based routing (becomes URLs)
├── lib/               # Utilities, db, helpers
│   └── db/            # Database wrapper and migrations
└── styles/            # Global CSS, Tailwind config
```

## Component Guidelines

### Astro Components (.astro)

- Prefer for static or lightly interactive components
- Use `<style>` blocks for scoped styles
- Import with `@/components/MyComponent.astro` (alias configured)

### React Components (.tsx)

- Use when you need complex client-side interactivity
- Must use hydration directive in Astro: `<MyReactComponent client:load />`
- Keep small and focused

## Environment Variables

- **Location**: `.env` file (gitignored)
- **Access in Astro**:
  - Public (client-side): `PUBLIC_*` prefix → `import.meta.env.PUBLIC_API_URL`
  - Private (server-only): No prefix → `import.meta.env.SECRET_KEY`
- **Always provide `.env.example`** with dummy values

## SEO & Meta Tags

- Centralize in `src/layouts/Layout.astro`
- Use `astro-seo` package for OpenGraph, Twitter cards
- Support `SITE_URL` and `APP_ENV` environment variables:
  - `APP_ENV=production` → indexable
  - Otherwise → `noindex, nofollow`

## Code Quality

### Required Scripts (in package.json)

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "lint": "eslint . --ext .js,.ts,.astro",
    "lint:fix": "eslint . --ext .js,.ts,.astro --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "astro check"
  }
}
```

### Linting & Formatting

- **ESLint**: Use `eslint-plugin-astro` for `.astro` files
- **Prettier**: Use `prettier-plugin-astro`
- **Pre-commit**: Set up Husky + lint-staged for automatic checks

## Routing

- **File-based**: `src/pages/about.astro` → `/about`
- **Dynamic**: `src/pages/blog/[slug].astro` → `/blog/:slug`
- **Index**: `src/pages/index.astro` → `/`

## Important Don'ts

- ❌ NO `dark:` classes in Tailwind (use semantic colors)
- ❌ NO Drizzle ORM (use plain SQLite with better-sqlite3)
- ❌ NO API routes for non-streaming endpoints (use Astro Actions)
- ❌ NO `"use client"` directive (that's Next.js)
- ❌ NO npm or yarn (use pnpm)
- ❌ NO inline styles in generated code (use Tailwind utilities or scoped `<style>`)

## Design System

All projects use **shadcn/ui + Tailwind CSS v4**:

- Modern, accessible, component-based UI library
- Built on Radix UI primitives
- Highly customizable with CSS variables
- Components are copied into the project (you own the code)
- Perfect for any type of application (tools, dashboards, marketing sites, etc.)

### Base Components Included

Every project starts with these essential components in `src/components/ui/`:
- `button.tsx` - Button with variants (default, outline, ghost, destructive, link)
- `card.tsx` - Card container (Header, Title, Description, Content, Footer)
- `input.tsx` - Text input field
- `label.tsx` - Form label
- `utils.ts` - cn() utility for className merging

### Adding More Components

Use the **shadcn CLI** to add components on-demand:

```bash
# Add a single component
pnpm dlx shadcn@latest add dialog

# Add multiple components
pnpm dlx shadcn@latest add dropdown-menu select checkbox

# Add all components (not recommended - adds 50+ files)
pnpm dlx shadcn@latest add --all
```

**Important**: 
- Always use `pnpm dlx shadcn@latest add [component]` (NOT npm or npx)
- The CLI will automatically:
  - Install required dependencies (@radix-ui/*, etc.)
  - Create component files in `src/components/ui/`
  - Update `components.json` config
- Available components: https://ui.shadcn.com/docs/components

### Color Token Adaptation

shadcn components use default tokens that must be mapped to doce.dev's semantic system:

| shadcn Default | doce.dev Semantic | Usage |
|----------------|-------------------|-------|
| `bg-background` | `bg-bg` | Page background |
| `bg-card` | `bg-surface` | Cards, panels |
| `bg-primary` | `bg-cta` | Primary buttons |
| `text-foreground` | `text-fg` | Default text |
| `text-muted-foreground` | `text-muted` | Secondary text |
| `border` / `border-input` | `border-border` | Borders |
| `bg-destructive` | `bg-danger` | Destructive actions |
| `bg-accent` | `bg-raised` | Hover states |

**After adding components**, review generated files and replace shadcn tokens with semantic tokens if needed.

## Generation Workflow

1. Copy `templates/astro-starter` to new project directory
2. Copy shadcn-tailwind design system files (`components/`, `layouts/`, `styles/`) into project
3. Generate pages in `src/pages/` based on user requirements
4. Create necessary components in `src/components/`
5. Set up Astro Actions in `src/actions/` for any server logic
6. Configure database if persistence is needed (`src/lib/db.ts`)
7. Update `package.json` metadata (name, description)
8. Create `.env.example` with required variables
9. Generate complete `README.md` with setup instructions

## Documentation Requirements

Every generated project MUST include:

- **README.md**: Setup instructions, scripts, environment variables
- **.env.example**: All required environment variables with dummy values
- **AGENTS.md**: If structure differs from starter template, document changes

## Testing & Validation

Before considering a project complete:

1. Run `pnpm type-check` (must pass)
2. Run `pnpm lint` (must pass)
3. Run `pnpm format:check` (must pass)
4. Run `pnpm build` (must succeed)
5. Verify `.env.example` has all variables
6. Ensure README has complete setup instructions

---

**Last Updated**: 2025-11-22
**Applies to**: All projects generated by doce.dev AI builder
