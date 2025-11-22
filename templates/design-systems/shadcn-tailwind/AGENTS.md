# shadcn/ui + Tailwind Design System

Modern, accessible, customizable component library for Astro projects.

## Overview

This design system provides:
- **shadcn/ui components** adapted for Astro
- **Tailwind CSS v4** with semantic color system
- **Accessible** components (ARIA compliant)
- **Type-safe** with full TypeScript support
- **Customizable** with CSS variables

## Installation in Generated Projects

When this design system is selected, the AI will:

1. **Copy base files** from this directory into the project:
   - `components/` → `src/components/ui/` (button, card, input, label, utils)
   - `styles/` → `src/styles/` (globals.css with semantic color system)

2. **Install base dependencies**:
   ```bash
   pnpm add @radix-ui/react-slot @radix-ui/react-label
   pnpm add class-variance-authority clsx tailwind-merge
   pnpm add lucide-react  # for icons
   ```

3. **Add components on-demand** using shadcn CLI:
   ```bash
   # Example: Add dialog component
   pnpm dlx shadcn@latest add dialog
   
   # Add multiple components
   pnpm dlx shadcn@latest add dropdown-menu select checkbox
   ```

4. **Configure Tailwind CSS v4** in `astro.config.mjs`:
   ```javascript
   import tailwindcss from '@tailwindcss/vite';
   
   export default defineConfig({
     vite: {
       plugins: [tailwindcss()],
     },
   });
   ```

5. **Import global styles** in main layout:
   ```css
   @import "tailwindcss";
   @import "../styles/globals.css";
   ```

## Component Structure

### Components (`components/`)

Place shadcn/ui components here. Each component should be a standalone `.tsx` file that can be imported and used in Astro pages.

Example component structure:
```typescript
// components/button.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-cta text-strong",
        outline: "border border-border bg-surface",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

### Layouts (`layouts/`)

Reusable layout templates with navigation, footers, etc.

Example:
```astro
---
// layouts/AppLayout.astro
interface Props {
  title: string;
}
const { title } = Astro.props;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
  </head>
  <body class="bg-bg text-fg">
    <nav class="bg-surface border-b border-border">
      <!-- Navigation -->
    </nav>
    <main class="container mx-auto px-4 py-8">
      <slot />
    </main>
  </body>
</html>
```

### Styles (`styles/`)

Global CSS and Tailwind configuration.

Example `globals.css`:
```css
@import "tailwindcss";

@theme {
  /* Semantic color variables */
  --color-bg: oklch(0.98 0 0);
  --color-surface: oklch(1 0 0);
  --color-raised: oklch(0.95 0 0);
  --color-cta: oklch(0.14 0 0);
  
  --color-text-strong: oklch(0.14 0 0);
  --color-text-fg: oklch(0.3 0 0);
  --color-text-muted: oklch(0.5 0 0);
  
  --color-border: oklch(0.9 0 0);
  
  /* Spacing */
  --spacing: 0.25rem;
  
  /* Border radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
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

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-bg text-fg;
  }
}
```

## Utility Functions

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Usage in Astro Pages

```astro
---
import { Button } from "@/components/ui/button";
import AppLayout from "@/layouts/AppLayout.astro";
---

<AppLayout title="Home">
  <h1 class="text-4xl font-bold text-strong">Welcome</h1>
  <Button variant="default" client:load>
    Click Me
  </Button>
</AppLayout>
```

## Customization

### Colors

Edit theme variables in `styles/globals.css`:

```css
@theme {
  --color-brand: oklch(0.55 0.24 262);  /* Custom brand color */
}
```

Then use:
```html
<button class="bg-brand text-white">Brand Button</button>
```

### Components

Override component styles using `className` prop:

```tsx
<Button className="rounded-full px-8">Custom Button</Button>
```

## Available Components

All shadcn/ui components are pre-installed and ready to use:

- **Button**: Primary, secondary, outline, ghost variants
- **Card**: Container with header, content, footer
- **Dialog**: Modal dialogs
- **Form**: Form fields with validation
- **Input**: Text inputs, textareas
- **Select**: Dropdown selects
- **Toast**: Notification toasts
- **Tabs**: Tabbed interfaces
- **Table**: Data tables
- **Badge**: Status badges
- **Avatar**: User avatars
- **Dropdown**: Dropdown menus
- **Navigation**: Nav bars, breadcrumbs
- **And more...**

## Best Practices

1. **Semantic Colors**: Always use semantic color variables (`bg-surface`, `text-fg`) instead of hardcoded colors
2. **Responsive**: Use Tailwind breakpoints (`sm:`, `md:`, `lg:`) for responsive design
3. **Accessibility**: Use proper ARIA attributes, labels, and keyboard navigation
4. **Type Safety**: Export component prop types for better DX
5. **Composition**: Combine small components to build complex UIs

## Resources

- [shadcn/ui Docs](https://ui.shadcn.com/docs)
- [Tailwind CSS v4 Docs](https://tailwindcss.com/docs)
- [Astro Docs](https://docs.astro.build)
- [Radix UI Primitives](https://www.radix-ui.com/primitives) (used by shadcn/ui)

---

**Note**: This design system is automatically configured when selected by the AI. All components are generated based on project requirements.
