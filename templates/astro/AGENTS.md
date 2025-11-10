# Agent Guidelines for Astro Project

This file contains rules and guidelines that AI agents should follow when modifying this project.

## Stack & Architecture

- **Framework**: Astro 5 with React 19 islands architecture
- **Styling**: Tailwind CSS v4 (configured via PostCSS) + shadcn/ui components
- **TypeScript**: Strict mode enabled
- **Components**: React functional components with TypeScript + shadcn/ui primitives
- **Layouts**: Use Astro layouts in `src/layouts/` (BaseLayout.astro)

### Package Manager: pnpm Only

**This project uses pnpm exclusively.** Do not reference npm or yarn commands.

If you need additional packages for a specific feature:
1. **Generate the component code** using the feature
2. **In your response text**, mention: "To complete this feature, run: `pnpm add [package-name]`"
3. **Let the user decide** whether to add it

Correct commands:
- ✅ `pnpm install` (install dependencies)
- ✅ `pnpm add package-name` (add new package)
- ✅ `pnpm run dev` (start dev server)
- ✅ `pnpm dlx shadcn@latest add component-name` (add shadcn component)
- ❌ `npm install` (wrong - don't use npm)
- ❌ `yarn add` (wrong - don't use yarn)

Modifying package.json can break the build system. The existing dependencies cover 99% of use cases.

## 🎨 Design System

Light/Dark/System toggle available via `useTheme()` hook (localStorage + system preference).

### Tailwind v4 with shadcn/ui:

**Use Tailwind's default color palette** for your components:
- Primary actions: `bg-blue-600`, `text-white`, `hover:bg-blue-700`
- Backgrounds: `bg-white`, `bg-gray-50`, `bg-gray-100` (light mode), `bg-gray-900`, `bg-gray-800` (dark mode)
- Text: `text-gray-900`, `text-gray-600`, `text-gray-500` (light mode), `text-white`, `text-gray-300` (dark mode)
- Borders: `border-gray-200` (light), `border-gray-700` (dark)

**Semantic Colors** (use Tailwind's built-in):
- Success: `text-green-600`, `bg-green-500`
- Warning: `text-yellow-600`, `bg-yellow-500`
- Danger/Destructive: `text-red-600`, `bg-red-500`

### Design Elements:

- **Borders**: Standard borders with `rounded-lg`, `rounded-md`
- **Buttons**: Use shadcn `<Button>` component with variants
- **Cards**: Use shadcn `<Card>` component with rounded corners and shadows
- **Interactive states**: Hover, focus, and active states included in shadcn components

### Theme Hook:

```tsx
import { useTheme } from "@/hooks/use-theme";

function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  // theme: "light" | "dark" | "system"
  // resolvedTheme: "light" | "dark"
  return <button onClick={() => setTheme("dark")}>Dark</button>;
}
```

## Styling Rules (CRITICAL)

### Use shadcn/ui Components + Tailwind

**NEVER generate unstyled components.** Use shadcn/ui components from `@/components/ui/` + Tailwind utility classes.

#### Available shadcn/ui Components:

`Button`, `Card`, `Input`, `Label`, `Textarea`, `Select`, `Dialog`, `Sheet`, `Popover`, `Dropdown Menu`, `Tabs`, `Accordion`, `Alert`, `Badge`, `Avatar`, `Checkbox`, `Switch`, `Radio Group`, `Slider`, `Progress`, `Skeleton`, `Spinner`, `Toast`, `Tooltip`, `Separator`, `Table`, `Form`, `Command`, and more.

#### Required Styling Patterns:

1. **Typography**:
   - Headings: `text-2xl font-bold text-gray-900`, `text-xl font-semibold text-gray-900`
   - Body text: `text-base text-gray-700`, `text-sm text-gray-600`
   - Use semantic HTML (`h1`, `h2`, `p`, etc.)

2. **Layout**:
   - Containers: `max-w-7xl mx-auto px-4`
   - Flexbox: `flex items-center justify-between gap-4`
   - Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
   - Spacing: Use consistent spacing scale (`p-4`, `mb-6`, `space-y-4`)

3. **Colors**:
   - Primary actions: `bg-blue-600 text-white hover:bg-blue-700`
   - Backgrounds: `bg-white`, `bg-gray-50`, `bg-gray-100`
   - Text: `text-gray-900`, `text-gray-600`, `text-gray-500`
   - Borders: `border border-gray-200`
   - Semantic: `text-red-600` (errors), `text-green-600` (success)

4. **Interactive Elements**:
   - Use `<Button>` from shadcn: `<Button variant="default">Click</Button>`
   - Button variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
   - Links: `text-blue-600 hover:text-blue-800 hover:underline`
   - Hover states: `hover:shadow-lg` (for cards)
   - Focus states: Already handled by shadcn components

5. **Cards & Containers**:
   - Use shadcn `<Card>`: 
     ```tsx
     <Card className="hover:shadow-lg transition-shadow">
       <CardHeader>
         <CardTitle>Title</CardTitle>
         <CardDescription>Description</CardDescription>
       </CardHeader>
       <CardContent>Content</CardContent>
     </Card>
     ```
   - Sections: `py-12 md:py-16 lg:py-20`

6. **Responsive Design**:
   - Always use responsive utilities: `md:`, `lg:`, `xl:`
   - Mobile-first approach
   - Example: `text-sm md:text-base lg:text-lg`

### Example Component Structure:

```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  city: string;
  temp: number;
}

export function WeatherCard({ city, temp }: Props) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-2xl text-gray-900">{city}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-4xl font-bold text-blue-600">{temp}°</span>
          <div className="text-gray-600">
            <p className="text-sm">Partly Cloudy</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Component Guidelines

### React Components

1. **Always use TypeScript**:
   ```tsx
   interface Props {
     title: string;
     count: number;
   }

   export function MyComponent({ title, count }: Props) {
     // ...
   }
   ```

2. **Use shadcn/ui components** from `@/components/ui/`:
   ```tsx
   import { Button } from "@/components/ui/button";
   import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
   import { Input } from "@/components/ui/input";
   import { Label } from "@/components/ui/label";
   ```

3. **Use proper client directives in Astro files**:
   - `client:load` - Load immediately
   - `client:idle` - Load when browser is idle
   - `client:visible` - Load when visible in viewport

4. **File naming**:
   - React components: PascalCase (`WeatherWidget.tsx`)
   - Astro pages: kebab-case or index (`about.astro`, `index.astro`)
   - Layouts: PascalCase (`BaseLayout.astro`)

### State Management

- Use React hooks (`useState`, `useEffect`, `useRef`, etc.)
- Keep state local to components when possible
- For shared state, consider React Context or props drilling
- Use `useTheme()` hook for theme-aware components

## File Structure

```
src/
├── components/
│   ├── ui/          # shadcn/ui components (Button, Card, Input, etc.)
│   └── *.tsx        # Custom React components
├── layouts/         # Astro layouts (BaseLayout.astro)
├── pages/          # Astro pages and API routes
├── hooks/          # React hooks (use-theme.ts)
└── lib/            # Utilities (utils.ts with cn() helper)
```

## API & Data Fetching

- Use `fetch()` for API calls
- Handle loading and error states
- Example:
  ```tsx
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);
  ```

## Environment Variables

**The project includes an Environment tab in the UI for managing variables.**

### How to Use Environment Variables:

1. **Add variables via the Environment tab** in the preview interface
2. **Access in server-side code** (Astro components, API routes):
   ```tsx
   const apiKey = import.meta.env.YOUR_API_KEY
   ```
3. **Access in client-side code** (React components with `client:*` directive):
   ```tsx
   // Must be prefixed with PUBLIC_
   const apiKey = import.meta.env.PUBLIC_YOUR_API_KEY
   ```

### Important Rules:

- ✅ **Server-side variables**: Any name (e.g., `API_KEY`, `DATABASE_URL`)
- ✅ **Client-side variables**: Must start with `PUBLIC_` (e.g., `PUBLIC_API_KEY`)
- ✅ Variables are loaded from `.env` file automatically
- ✅ Changes require preview restart (done automatically via UI)

### When API Keys Are Needed:

If you're building a feature that requires API keys (weather, maps, etc.):
1. **Generate the code** assuming the env var exists
2. **In your response**, remind the user to:
   - Go to the Environment tab
   - Add the required variable (e.g., `PUBLIC_WEATHER_API_KEY`)
   - The preview will automatically restart with the new variable

Example reminder:
```
To use this weather app:
1. Get an API key from OpenWeatherMap
2. Go to the Environment tab
3. Add: PUBLIC_WEATHER_API_KEY = your_key_here
4. The preview will restart automatically
```

## Accessibility

- Use semantic HTML elements
- Include ARIA labels when needed
- Ensure keyboard navigation works
- Maintain proper heading hierarchy
- Add alt text to images

## Performance

- Use Astro islands for interactive components
- Minimize client-side JavaScript
- Optimize images (use Astro's Image component when available)
- Lazy load components when appropriate

## Code Quality

1. **Imports**: Group and order logically
   ```tsx
   // React imports
   import { useState } from 'react';

   // Component imports
   import { Button } from './Button';

   // Types
   import type { User } from '../types';
   ```

2. **Formatting**: Use consistent formatting
   - 2 spaces for indentation
   - Semicolons optional (be consistent)
   - Single quotes for strings (or double - be consistent)

3. **Comments**: Add comments for complex logic, not obvious code

## Common Patterns

### Hero Section
```tsx
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
          Your Hero Title
        </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl">
          Your hero description
        </p>
        <Button size="lg">Call to Action</Button>
      </div>
    </section>
  );
}
```

### Feature Grid with Cards
```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function Features() {
  const features = [
    { id: 1, title: "Fast", description: "Lightning fast performance" },
    { id: 2, title: "Modern", description: "Built with latest tech" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {features.map((feature) => (
        <Card key={feature.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="text-gray-900">{feature.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{feature.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Form with shadcn
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function ContactForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Us</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>
          <Button type="submit" className="w-full">Submit</Button>
        </form>
      </CardContent>
    </Card>
  );
}

## Important Reminders

1. **Use shadcn/ui components** - Import from `@/components/ui/` before building custom UI
2. **Use Tailwind colors** - Standard palette: `bg-blue-600`, `text-gray-900`, `border-gray-200`, etc.
3. **Mobile-first** - Start with mobile layout, add responsive classes
4. **Type everything** - Use TypeScript interfaces and types
5. **Semantic HTML** - Use proper HTML5 elements
6. **Test responsive** - Consider all screen sizes
7. **Theme-aware** - Use `useTheme()` hook when needed for dark/light mode support

## What NOT to Do

❌ Don't create unstyled components
❌ Don't use inline styles (style={{...}})
❌ Don't write custom CSS files (use Tailwind + shadcn)
❌ Don't reinvent UI components (use shadcn first)
❌ Don't ignore TypeScript errors
❌ Don't forget responsive design
❌ Don't skip accessibility attributes
❌ Don't use class components (use functional)

## When Making Changes

1. Understand the existing structure
2. Check if shadcn/ui has the component you need
3. Use Tailwind's standard color palette
4. Use shadcn components + Tailwind utilities
5. Ensure responsive design
6. Test that components render properly in both light and dark modes
7. Maintain consistent styling throughout

## Adding New shadcn Components

If you need a shadcn component not yet in the project:

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add dialog
```

Available components: https://ui.shadcn.com/docs/components

## Adding Icons

For provider icons or other SVG assets:

```bash
pnpm dlx shadcn@latest add @svgl/anthropic
pnpm dlx shadcn@latest add @svgl/openai
```

Icons will be added to `src/components/ui/svgs/`

---

**Remember**: This is a shadcn/ui + Tailwind project. Use shadcn components for UI primitives, Tailwind's standard color palette for styling, and ensure responsive, accessible design.
