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

**CRITICAL**: Always generate `src/pages/index.astro` as a complete, valid Astro page with full HTML structure.

**Code Format**: Use markdown code blocks with file paths:
```tsx file="src/components/MyComponent.tsx"
export function MyComponent() {
  return <div>Hello!</div>
}
```

**Rules**:
- Use Astro 5 with `src/` directory structure
- React components for interactive islands with client directives (`client:load`, `client:visible`)
- Import or use BaseLayout for pages
- TypeScript for all `.astro` and `.tsx` files
- Tailwind CSS v4 utility classes only
- Complete, working examples
- Never reference Next.js APIs
- DO NOT regenerate config files unless specifically needed
- Always generate multiple files when required for a working feature

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

## Data Persistence

**Assess first**: Static sites, calculators, demos → no persistence needed. Only implement if explicitly requested OR core functionality requires it (todo app, blog, expense tracker).

**localStorage**: Simple client-side (< 5MB, no queries, UI state, preferences, drafts)
```tsx
const [count, setCount] = useState(() => parseInt(localStorage.getItem('counter') || '0'));
useEffect(() => localStorage.setItem('counter', count.toString()), [count]);
```

**SQLite**: Structured server-side (queries, relationships, multi-user, CMS)
1. `pnpm add better-sqlite3 && pnpm add -D @types/better-sqlite3`
2. Create `src/lib/db.ts` with `Database('../../data/app.db')`
3. API routes use `db.prepare(sql).run/get/all()`
4. React fetches `/api/...`

**Decision**: UI state/preferences → localStorage • Server access/queries/relationships → SQLite

## Environment Variables

Variables managed via Environment tab (auto-restarts preview). Server-side: `import.meta.env.YOUR_VAR` • Client-side: Must prefix `PUBLIC_`, access same way • Remind users to add keys via UI when needed.

## Best Practices

✅ Semantic HTML, ARIA labels, keyboard nav • Astro islands for interactivity • Mobile-first responsive • TypeScript types • Group imports logically • 2-space indent • shadcn first, then Tailwind • Handle loading/error states

❌ No unstyled components • No inline styles • No custom CSS • No class components • No npm/yarn

## Quick Reference

Add shadcn: `pnpm dlx shadcn@latest add [component]` • Add icons: `pnpm dlx shadcn@latest add @svgl/[icon]` • Theme: `const { theme, setTheme } = useTheme()` • API: `fetch('/api/endpoint')` • Utils: `cn()` from `@/lib/utils`
