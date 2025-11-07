# Agent Guidelines for Astro Project

This file contains rules and guidelines that AI agents should follow when modifying this project.

## Stack & Architecture

- **Framework**: Astro 5 with React 19 islands architecture
- **Styling**: Tailwind CSS v4 (configured via PostCSS)
- **TypeScript**: Strict mode enabled
- **Components**: Use React functional components with TypeScript
- **Layouts**: Use Astro layouts in `src/layouts/`

## ⚠️ CRITICAL: Do NOT Modify Package.json

**NEVER generate or modify `package.json` unless explicitly asked.**

The project already has all required dependencies configured:
- Astro 5.1.0+
- React 19.2.0
- @astrojs/react (required for React integration)
- Tailwind CSS 4.1.9+
- @tailwindcss/postcss (required for Tailwind)
- TypeScript 5.x

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
- ❌ `npm install` (wrong - don't use npm)
- ❌ `yarn add` (wrong - don't use yarn)

Modifying package.json can break the build system. The existing dependencies cover 99% of use cases.

## Styling Rules (CRITICAL)

### Always Use Tailwind CSS

**NEVER generate unstyled components.** Every component must use Tailwind utility classes for styling.

#### Required Styling Patterns:

1. **Typography**:
   - Headings: `text-2xl font-bold`, `text-xl font-semibold`, etc.
   - Body text: `text-base`, `text-sm`, `text-gray-700`
   - Use semantic HTML (`h1`, `h2`, `p`, etc.)

2. **Layout**:
   - Containers: `max-w-7xl mx-auto px-4`
   - Flexbox: `flex items-center justify-between gap-4`
   - Grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
   - Spacing: Use consistent spacing scale (`p-4`, `mb-6`, `space-y-4`)

3. **Colors**:
   - Primary actions: `bg-blue-600 text-white hover:bg-blue-700`
   - Secondary: `bg-gray-100 text-gray-900 hover:bg-gray-200`
   - Borders: `border border-gray-200`
   - Text: `text-gray-900`, `text-gray-600`, `text-gray-500`

4. **Interactive Elements**:
   - Buttons: `px-4 py-2 rounded-lg font-medium transition-colors`
   - Links: `text-blue-600 hover:text-blue-800 underline`
   - Hover states: Always include `hover:` variants
   - Focus states: `focus:outline-none focus:ring-2 focus:ring-blue-500`

5. **Cards & Containers**:
   - Cards: `bg-white rounded-lg shadow-md p-6 border border-gray-100`
   - Sections: `py-12 md:py-16 lg:py-20`

6. **Responsive Design**:
   - Always use responsive utilities: `md:`, `lg:`, `xl:`
   - Mobile-first approach
   - Example: `text-sm md:text-base lg:text-lg`

### Example Component Structure:

```tsx
export function WeatherCard({ city, temp }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{city}</h2>
      <div className="flex items-center justify-between">
        <span className="text-4xl font-bold text-blue-600">{temp}°</span>
        <div className="text-gray-600">
          <p className="text-sm">Partly Cloudy</p>
        </div>
      </div>
    </div>
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

2. **Use proper client directives in Astro files**:
   - `client:load` - Load immediately
   - `client:idle` - Load when browser is idle
   - `client:visible` - Load when visible in viewport

3. **File naming**:
   - React components: PascalCase (`WeatherWidget.tsx`)
   - Astro pages: kebab-case or index (`about.astro`, `index.astro`)
   - Layouts: PascalCase (`BaseLayout.astro`)

### State Management

- Use React hooks (`useState`, `useEffect`, `useRef`, etc.)
- Keep state local to components when possible
- For shared state, consider React Context or props drilling

## File Structure

```
src/
├── components/      # React components (.tsx)
├── layouts/         # Astro layouts (.astro)
├── pages/          # Astro pages and API routes
└── styles/         # Global styles (minimal - prefer Tailwind)
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
<section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100">
  <div className="max-w-7xl mx-auto px-4">
    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
      Your Hero Title
    </h1>
    <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl">
      Your hero description
    </p>
    <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
      Call to Action
    </button>
  </div>
</section>
```

### Feature Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  {features.map((feature) => (
    <div key={feature.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-100">
      <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
      <p className="text-gray-600">{feature.description}</p>
    </div>
  ))}
</div>
```

## Important Reminders

1. **ALWAYS use Tailwind classes** - Never write components without styling
2. **Mobile-first** - Start with mobile layout, add responsive classes
3. **Consistent spacing** - Use Tailwind's spacing scale consistently
4. **Type everything** - Use TypeScript interfaces and types
5. **Semantic HTML** - Use proper HTML5 elements
6. **Test responsive** - Consider all screen sizes

## What NOT to Do

❌ Don't create unstyled components  
❌ Don't use inline styles (style={{...}})  
❌ Don't write custom CSS files (use Tailwind)  
❌ Don't ignore TypeScript errors  
❌ Don't forget responsive design  
❌ Don't skip accessibility attributes  
❌ Don't use class components (use functional)  

## When Making Changes

1. Understand the existing structure
2. Follow established patterns
3. Use Tailwind utilities extensively
4. Ensure responsive design
5. Test that components render properly
6. Maintain consistent styling throughout

---

**Remember**: This is a Tailwind-first project. Every UI element should be styled with utility classes. Beautiful, responsive design is expected by default.
