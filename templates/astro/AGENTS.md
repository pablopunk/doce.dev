# Agent Guidelines for Astro Project

## Initial Project Setup

A minimal Astro project template has been set up with:
- package.json (Astro, React, Tailwind v4 dependencies)
- astro.config.mjs (React integration)
- tsconfig.json
- tailwind.config.cjs
- postcss.config.cjs (Tailwind v4)
- src/styles/global.css (`@import "tailwindcss"`)
- src/layouts/BaseLayout.astro (imports global.css)

**Your job**: Generate ONLY application-specific files needed:
- `src/pages/index.astro` - Main landing page (REQUIRED - always generate)
- `src/components/*.tsx` - React components for interactive features
- Additional pages/components as needed

**Code Format**: Use markdown code blocks with file paths:
```tsx file="src/components/MyComponent.tsx"
export function MyComponent() {
  return <div>Hello!</div>
}
```

## Development Environment (Docker)

**⚠️ IMPORTANT - This project runs in a Docker container managed by doce.dev:**

- **Dev server is ALREADY RUNNING** via docker-compose (`pnpm run dev --host 0.0.0.0`)
- **DO NOT run `pnpm run dev`** - the container is already serving on port 4321
- **Preview URL is automatically exposed** and refreshes on file changes
- **Package installation**: When you modify `package.json` dependencies, run `pnpm install` to update node_modules
- **Environment variables**: Managed via Environment tab, auto-restarts container

**Available Commands** (via `runCommand` tool):
- `pnpm install` - Install/update dependencies after package.json changes
- `pnpm add <package>` - Add new dependencies if needed (e.g., `pnpm add recharts`)

**What NOT to do**:
- ❌ Don't run `pnpm run dev` (already running in Docker)
- ❌ Don't try to start/stop the dev server
- ❌ Don't worry about port configuration (handled by Docker)

## Rules

**DO**:
- Use Astro 5 with `src/` directory structure
- React components for interactive islands with client directives (`client:load`, `client:visible`)
- Import or use BaseLayout for pages
- TypeScript for all `.astro` and `.tsx` files
- Tailwind CSS v4 utility classes only
- Complete, working examples
- Always generate multiple files when required for a working feature
- Keep functions small (<20 lines) for readability
- Use Astro Actions for server functions with Zod validation
- Import actions with `import { actions } from "astro:actions"`

**DON'T**:
- Never reference Next.js APIs
- DO NOT regenerate config files unless specifically needed
- No duplicate HTML across pages
- No full pages in `.astro` without layouts
- No `fetch()` for internal APIs (use Actions instead) if possible (CRUD, forms, etc.)
- No API routes for CRUD operations (use Actions)

## CRITICAL: .astro vs .tsx Syntax

**⚠️ DIFFERENT SYNTAX FOR DIFFERENT FILES:**

**.astro files** → Use `class` (HTML syntax):
```astro
<div class="max-w-4xl mx-auto p-6">
  <h1 class="text-2xl font-bold">Hello</h1>
</div>
```

**.tsx files** → Use `className` (JSX syntax):
```tsx
export function MyComponent() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Hello</h1>
    </div>
  );
}
```

**Rule**: ALWAYS use `class` in `.astro` files, ALWAYS use `className` in `.tsx` files. Mixing them causes build errors.

## Stack

Astro 5 + React 19 islands + Tailwind v4 + TypeScript strict + shadcn/ui + `useTheme()` hook (light/dark/system)

**Package Manager: pnpm only** - Commands: `pnpm install`, `pnpm add pkg`, `pnpm run dev`, `pnpm dlx shadcn@latest add component`

## Design System

**Tailwind Default Palette** - Primary: `bg-blue-600 text-white hover:bg-blue-700` • Backgrounds: `bg-white/gray-50/100` (light), `bg-gray-900/800` (dark) • Text: `text-gray-900/600/500` (light), `text-white/gray-300` (dark) • Borders: `border-gray-200` (light), `border-gray-700` (dark) • Semantic: green (success), yellow (warning), red (danger)

## Styling Rules (CRITICAL)

**NEVER generate unstyled components.** Use shadcn/ui from `@/components/ui/` + Tailwind utilities.

**Available**: Button, Card, Input, Label, Textarea, Select, Dialog, Sheet, Popover, Dropdown Menu, Tabs, Accordion, Alert, Badge, Avatar, Checkbox, Switch, Radio Group, Slider, Progress, Skeleton, Spinner, Toast, Tooltip, Separator, Table, Form, Command

**Patterns**:
- Typography: `text-2xl font-bold text-gray-900` (headings), `text-base text-gray-700` (body)
- Layout: `max-w-7xl mx-auto px-4`, `flex items-center gap-4`, `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Responsive: Mobile-first with `md:`, `lg:`, `xl:`
- Cards: `<Card className="hover:shadow-lg transition-shadow">` with CardHeader, CardTitle, CardContent

## Components

**TypeScript always** - PascalCase for React (`.tsx`), kebab-case for Astro pages (`.astro`) • Client directives: `client:load`, `client:idle`, `client:visible` • State: React hooks, keep local, use Context for shared • File structure: `src/components/ui/` (shadcn), `src/components/` (custom), `src/layouts/`, `src/pages/`, `src/hooks/`, `src/lib/`

## Server-Side Logic (Astro Actions)

**Use Astro Actions** for server-side operations: forms, mutations, validation, API calls. Actions = type-safe server functions.

**See complete working examples:**
- **`src/actions/index.ts`** - Example actions with validation and error handling
- **`src/components/NewsletterForm.example.tsx`** - React component with loading states, error handling, and shadcn/ui integration

### Quick Example

Actions are defined in `src/actions/index.ts`:

```typescript
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';

export const server = {
  subscribe: defineAction({
    input: z.object({ email: z.string().email() }),
    handler: async ({ email }) => {
      // Your logic: DB save, API call, etc.
      return { success: true, message: "Subscribed!" };
    },
  }),
};
```

Called from React components:

```tsx
import { actions } from 'astro:actions';

const { data, error } = await actions.subscribe({ email });
if (error) {
  console.error(error.code, error.message);
}
```

### Form Actions (Zero-JS)

```astro
---
import { actions } from 'astro:actions';
const result = Astro.getActionResult(actions.subscribe);
---
{result?.error && <p class="text-red-600">{result.error.message}</p>}
{result?.data && <p class="text-green-600">Success!</p>}

<form method="POST" action={actions.subscribe}>
  <input name="email" type="email" required />
  <button type="submit">Subscribe</button>
</form>
```

### When to Use

✅ **Use Actions for:**
- Form submissions (contact, subscribe, auth)
- Data mutations (create, update, delete)
- Server-side validation
- API integrations
- File uploads

❌ **DON'T Use Actions for:**
- Static content (render in .astro)
- Client-only state (useState)
- Streaming (use API routes: `src/pages/api/stream.ts`)

### Error Codes

Standard codes: `NOT_FOUND`, `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_SERVER_ERROR`, `TOO_MANY_REQUESTS`

### Why Actions?

- ✅ **Type-safe**: Full TypeScript from server to client
- ✅ **Validated**: Automatic Zod validation on all inputs
- ✅ **Standardized**: ActionError with codes (NOT_FOUND, BAD_REQUEST, UNAUTHORIZED, etc.)
- ✅ **Debuggable**: HTTP access at `/_actions/{module}.{action}` for testing with curl
- ✅ **Simple**: No manual JSON parsing, no fetch boilerplate

**Streaming Endpoints** (use API routes, not Actions):
Actions don't support streaming responses - use traditional API routes (`src/pages/api/stream.ts`) for SSE/streaming.

## Data Persistence

**Assess first**: Static sites, calculators, demos → no persistence needed. Only implement if explicitly requested OR core functionality requires it (todo app, blog, expense tracker).

**localStorage**: Simple client-side (< 5MB, no queries, UI state, preferences, drafts)
```tsx
const [count, setCount] = useState(() => parseInt(localStorage.getItem('counter') || '0'));
useEffect(() => localStorage.setItem('counter', count.toString()), [count]);
```

**SQLite with Actions**: Structured server-side (queries, relationships, multi-user, CMS)
1. `pnpm add better-sqlite3 && pnpm add -D @types/better-sqlite3`
2. Create `src/lib/db.ts` with `Database('./data.db')`
3. Define actions in `src/actions/index.ts` that use the database
4. React components call actions: `await actions.myAction()`

**Decision**: UI state/preferences → localStorage • Server access/queries/relationships → Actions + SQLite

## Environment Variables

Variables managed via Environment tab (auto-restarts preview). Server-side: `import.meta.env.YOUR_VAR` • Client-side: Must prefix `PUBLIC_`, access same way • Remind users to add keys via UI when needed.

## Best Practices

✅ Semantic HTML, ARIA labels, keyboard nav • Astro islands for interactivity • Mobile-first responsive • TypeScript types • Group imports logically • 2-space indent • shadcn first, then Tailwind • Handle loading/error states • Use Actions for server logic, not fetch

❌ No unstyled components • No inline styles • No custom CSS • No class components • No npm/yarn • No fetch for internal APIs (use Actions)

## Debugging

**Actions**: Test with curl:
```bash
curl -X POST http://localhost:4321/_actions/myAction \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Common Issues**:
- Build errors → check imports, verify all files exist
- Type errors → ensure proper TypeScript configuration
- Actions not working → check `src/actions/index.ts` exports all action modules
- Preview not updating → check browser console for errors, verify action is called correctly

## Guidelines

- Use **pnpm** exclusively for all package operations
- Run `pnpm build` or `pnpm run dev` to test changes
- Install packages with `pnpm add <package>` if needed (template includes most common ones)
- Test actions with curl before integrating into UI
- Add shadcn components: `pnpm dlx shadcn@latest add [component]`
- Add icons: `pnpm dlx shadcn@latest add @svgl/{icon-name}`
- **Use Actions, not fetch**: `actions.myAction()` not `fetch('/api/endpoint')`

## Quick Reference

**Actions**: `import { actions } from 'astro:actions'` → `await actions.myAction({ input })` • Add shadcn: `pnpm dlx shadcn@latest add [component]` • Add icons: `pnpm dlx shadcn@latest add @svgl/[icon]` • Theme: `const { theme, setTheme } = useTheme()` • Utils: `cn()` from `@/lib/utils`

## Error Handling

Actions use `ActionError` for standardized errors:
```typescript
import { ActionError } from 'astro:actions';

throw new ActionError({
  code: "NOT_FOUND",        // NOT_FOUND, BAD_REQUEST, UNAUTHORIZED, etc.
  message: "Item not found"
});
```

Check for errors in components:
```typescript
const { data, error } = await actions.myAction({ id });
if (error) {
  console.error(error.code, error.message);
  return;
}
// Use data safely
```
