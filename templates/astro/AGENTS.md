# Agent Guidelines for Astro Full-Stack Applications

## Table of Contents

1. [AI Thinking Process](#ai-thinking-process)
2. [Project Planning Framework](#project-planning-framework)
3. [Initial Project Setup](#initial-project-setup)
4. [Development Workflow Phases](#development-workflow-phases)
5. [Stack & Technologies](#stack--technologies)
6. [File Structure & Organization](#file-structure--organization)
7. [Design System & Styling](#design-system--styling)
8. [UI/UX Pattern Library](#uiux-pattern-library)
9. [Backend API Patterns (Astro Actions)](#backend-api-patterns-astro-actions)
10. [Database Design Patterns](#database-design-patterns)
11. [Authentication & Authorization](#authentication--authorization)
12. [Data Persistence Strategies](#data-persistence-strategies)
13. [Performance Optimization](#performance-optimization)
14. [Security Best Practices](#security-best-practices)
15. [Accessibility Guidelines](#accessibility-guidelines)
16. [Third-Party Integrations](#third-party-integrations)
17. [File Upload Patterns](#file-upload-patterns)
18. [Real-time Features](#real-time-features)
19. [Testing Strategies](#testing-strategies)
20. [Complete Application Blueprints](#complete-application-blueprints)
21. [Debugging & Troubleshooting](#debugging--troubleshooting)
22. [Quick Reference](#quick-reference)

---

## AI Thinking Process

**Before generating any code, follow this structured thinking process:**

### 1. Understand Requirements
- [ ] What is the core functionality requested?
- [ ] Who are the target users?
- [ ] Is this a static site, interactive app, or full-stack application?
- [ ] What data persistence is needed (none, localStorage, database)?

### 2. Plan Architecture
- [ ] Which files need to be created/modified?
- [ ] What Astro Actions are needed?
- [ ] What database schema (if any)?
- [ ] What shadcn/ui components to use?

### 3. Check Accessibility & UX
- [ ] Are proper semantic HTML elements used?
- [ ] Are ARIA labels included where needed?
- [ ] Is keyboard navigation supported?
- [ ] Are loading and error states handled?
- [ ] Is the design mobile-responsive?

### 4. Validate Security
- [ ] Are user inputs validated (Zod schemas)?
- [ ] Are SQL queries parameterized?
- [ ] Are error messages user-friendly (no sensitive data)?
- [ ] Are authentication/authorization checks in place?

### 5. Code Generation Pattern
```
For each feature:
1. Generate database schema (if needed)
2. Create Astro Actions with validation
3. Build UI components with shadcn/ui
4. Add loading/error states
5. Implement accessibility features
6. Test with example data
```

### Decision Tree: When to Use What

```
Need interactivity?
├─ No → .astro page with static content
└─ Yes
    ├─ Client-only (no server) → React component with useState
    └─ Needs server logic
        ├─ Form submission → Astro Action
        ├─ Data fetching → Astro Action
        ├─ Real-time updates → API route with SSE
        └─ File upload → Astro Action with file handling
```

---

## Project Planning Framework

### User Stories Template

Always start complex features with user stories:

```
As a [user type],
I want to [action],
So that [benefit].

Example:
As a blog reader,
I want to filter posts by category,
So that I can find relevant content quickly.
```

### Feature Breakdown

**Core Features** (MVP - Must Have):
- Essential functionality for the app to work
- Example: For a todo app → Create, read, update, delete tasks

**Enhanced Features** (Should Have):
- Improves UX but not critical
- Example: For a todo app → Due dates, priority levels, categories

**Nice-to-Have Features** (Could Have):
- Advanced features for later iterations
- Example: For a todo app → Recurring tasks, subtasks, collaboration

### Technology Stack Decision Tree

```
Database needed?
├─ No → Static site (just .astro pages)
├─ Simple (key-value, < 5MB) → localStorage
└─ Complex (queries, relationships) → SQLite + better-sqlite3

Authentication needed?
├─ No → Skip auth setup
├─ Simple (single admin) → Password in environment variable
└─ Multi-user → Database users table + session management

Payments needed?
├─ No → Skip payment integration
└─ Yes → Stripe integration with webhooks

Real-time needed?
├─ No → Standard Astro Actions
└─ Yes → API routes with Server-Sent Events
```

---

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

### Development Environment (Docker)

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

---

## Development Workflow Phases

### Phase 1: Foundation (UI & Core Logic)

**Focus**: Get the visual structure and basic functionality working

1. **Create page structure**
   - Generate `src/pages/index.astro` with BaseLayout
   - Add navigation, hero sections, basic content
   - Use shadcn/ui components for consistency

2. **Build core UI components**
   - Interactive elements (buttons, forms, cards)
   - Mobile-responsive layouts
   - Loading and empty states

3. **Add client-side interactivity**
   - React components with `client:load` or `client:visible`
   - Local state management with useState
   - Form validation (client-side)

**Deliverable**: A working UI that looks good and responds to user interactions (without backend persistence)

### Phase 2: Data Layer (Persistence & Actions)

**Focus**: Add backend functionality and data persistence

1. **Design database schema** (if needed)
   - Plan tables and relationships
   - Create `src/lib/db.ts` with better-sqlite3
   - Write migration/initialization code

2. **Create Astro Actions**
   - Define actions in `src/actions/index.ts`
   - Add Zod validation schemas
   - Implement CRUD operations
   - Add proper error handling

3. **Connect UI to backend**
   - Replace useState with action calls
   - Add loading states during async operations
   - Handle errors gracefully
   - Show success feedback

**Deliverable**: Fully functional app with data persistence

### Phase 3: Advanced Features (Auth, Payments, Polish)

**Focus**: Production-ready features and optimizations

1. **Authentication** (if needed)
   - User registration and login
   - Session management
   - Protected routes with middleware
   - Password hashing with bcrypt

2. **Third-party integrations** (if needed)
   - Stripe for payments
   - Email services (Resend, SendGrid)
   - OAuth providers (Google, GitHub)

3. **Performance & Security**
   - Image optimization
   - Code splitting
   - Input sanitization
   - Rate limiting
   - Accessibility audit

**Deliverable**: Production-ready full-stack application

---

## Stack & Technologies

**Core Stack**:
- Astro 5 (SSR with Node adapter)
- React 19 (islands architecture)
- Tailwind CSS v4 (utility-first styling)
- TypeScript (strict mode)
- shadcn/ui (component library)

**Backend**:
- Astro Actions (type-safe server functions)
- better-sqlite3 (embedded database)
- Zod (input validation)

**Deployment**:
- Docker (containerized)
- Node.js runtime

**Package Manager**: pnpm only

---

## File Structure & Organization

```
src/
├── actions/
│   └── index.ts              # Server-side actions (exports { server })
├── components/
│   ├── ui/                   # shadcn/ui components (pre-installed)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── MyFeature.tsx         # Custom React components
│   └── AnotherFeature.tsx
├── layouts/
│   └── BaseLayout.astro      # Main layout wrapper
├── lib/
│   ├── db.ts                 # Database connection (if needed)
│   └── utils.ts              # Utility functions (cn, etc.)
├── pages/
│   ├── index.astro           # Homepage (always required)
│   ├── about.astro           # Additional pages
│   └── api/                  # API routes (for streaming only)
│       └── stream.ts
├── hooks/
│   └── use-theme.ts          # React hooks
├── middleware.ts             # Route protection, auth checks
└── styles/
    └── global.css            # Global styles (Tailwind import)
```

### Naming Conventions

- **Astro pages**: `kebab-case.astro` (e.g., `about-us.astro`)
- **React components**: `PascalCase.tsx` (e.g., `TodoList.tsx`)
- **Utilities/hooks**: `kebab-case.ts` (e.g., `use-auth.ts`)
- **Actions**: Descriptive names (e.g., `createTodo`, `updateUser`)

---

## Design System & Styling

### Color System

**Tailwind Default Palette** - No custom colors:
- **Primary**: `bg-blue-600 text-white hover:bg-blue-700`
- **Backgrounds (light)**: `bg-white`, `bg-gray-50`, `bg-gray-100`
- **Backgrounds (dark)**: `bg-gray-900`, `bg-gray-800`
- **Text (light)**: `text-gray-900`, `text-gray-600`, `text-gray-500`
- **Text (dark)**: `text-white`, `text-gray-300`, `text-gray-400`
- **Borders (light)**: `border-gray-200`, `border-gray-300`
- **Borders (dark)**: `border-gray-700`, `border-gray-600`
- **Semantic**:
  - Success: `text-green-600`, `bg-green-50`
  - Warning: `text-yellow-600`, `bg-yellow-50`
  - Danger: `text-red-600`, `bg-red-50`

### Theme System

Dark mode support via `useTheme()` hook:

```tsx
import { useTheme } from '@/hooks/use-theme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      Toggle theme
    </button>
  );
}
```

### CRITICAL: .astro vs .tsx Syntax

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

### Typography Scale

```
text-xs      → 12px (captions, labels)
text-sm      → 14px (secondary text)
text-base    → 16px (body text)
text-lg      → 18px (emphasis)
text-xl      → 20px (subheadings)
text-2xl     → 24px (section headings)
text-3xl     → 30px (page titles)
text-4xl     → 36px (hero headings)
```

### Spacing Scale

```
p-2  → 8px    (tight)
p-4  → 16px   (default)
p-6  → 24px   (comfortable)
p-8  → 32px   (spacious)
gap-4 → 16px  (component spacing)
gap-6 → 24px  (section spacing)
```

---

## UI/UX Pattern Library

### Common Layouts

#### Dashboard Layout
```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---

<BaseLayout title="Dashboard">
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-64 bg-gray-50 border-r border-gray-200 p-4">
      <nav class="space-y-2">
        <a href="/dashboard" class="block px-4 py-2 rounded hover:bg-gray-100">
          Dashboard
        </a>
        <a href="/settings" class="block px-4 py-2 rounded hover:bg-gray-100">
          Settings
        </a>
      </nav>
    </aside>

    <!-- Main content -->
    <main class="flex-1 p-8">
      <h1 class="text-3xl font-bold mb-6">Dashboard</h1>
      <!-- Content here -->
    </main>
  </div>
</BaseLayout>
```

#### Landing Page Layout
```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import Hero from '@/components/Hero';
---

<BaseLayout title="Home">
  <!-- Hero section -->
  <Hero client:load />

  <!-- Features section -->
  <section class="py-20 bg-gray-50">
    <div class="max-w-7xl mx-auto px-4">
      <h2 class="text-3xl font-bold text-center mb-12">Features</h2>
      <div class="grid md:grid-cols-3 gap-8">
        <!-- Feature cards -->
      </div>
    </div>
  </section>

  <!-- CTA section -->
  <section class="py-20">
    <div class="max-w-4xl mx-auto text-center px-4">
      <h2 class="text-3xl font-bold mb-4">Ready to get started?</h2>
      <button class="bg-blue-600 text-white px-8 py-3 rounded-lg">
        Get Started
      </button>
    </div>
  </section>
</BaseLayout>
```

#### Auth Page Layout
```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import AuthForm from '@/components/AuthForm';
---

<BaseLayout title="Sign In">
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold">Welcome back</h1>
        <p class="text-gray-600 mt-2">Sign in to your account</p>
      </div>
      <AuthForm client:load />
    </div>
  </div>
</BaseLayout>
```

### Form Patterns

#### Form with Validation (React)
```tsx
'use client';
import { useState } from 'react';
import { actions } from 'astro:actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const { data, error } = await actions.submitContact({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      message: formData.get('message') as string,
    });

    setLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Your message has been sent!',
    });

    e.currentTarget.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>

      <div>
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          required
          className="w-full min-h-[120px] px-3 py-2 border rounded-md"
        />
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Send Message'}
      </Button>
    </form>
  );
}
```

### Loading States

#### Skeleton Loader
```tsx
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
```

#### Spinner
```tsx
import { Spinner } from '@/components/ui/spinner';

export function LoadingState() {
  return (
    <div className="flex items-center justify-center p-8">
      <Spinner className="w-8 h-8" />
      <span className="ml-2 text-gray-600">Loading...</span>
    </div>
  );
}
```

### Error States

#### Inline Error
```tsx
{error && (
  <div className="text-sm text-red-600 mt-1">
    {error.message}
  </div>
)}
```

#### Error Alert
```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function ErrorAlert({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
```

### Empty States

```tsx
import { Empty } from '@/components/ui/empty';

export function EmptyTodos() {
  return (
    <Empty
      title="No todos yet"
      description="Create your first todo to get started"
      action={<Button>Create Todo</Button>}
    />
  );
}
```

### Responsive Patterns

#### Mobile-First Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  {items.map(item => (
    <Card key={item.id}>
      {/* Card content */}
    </Card>
  ))}
</div>
```

#### Responsive Navigation
```tsx
<nav className="flex flex-col md:flex-row md:items-center gap-4">
  <a href="/">Home</a>
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
</nav>
```

#### Hide on Mobile
```tsx
<div className="hidden md:block">
  {/* Desktop only content */}
</div>

<div className="md:hidden">
  {/* Mobile only content */}
</div>
```

---

## Backend API Patterns (Astro Actions)

### Basic CRUD Operations

#### Create Action
```typescript
// src/actions/index.ts
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { db } from '@/lib/db';

export const server = {
  createTodo: defineAction({
    input: z.object({
      title: z.string().min(1, "Title is required").max(200),
      description: z.string().optional(),
    }),
    handler: async ({ title, description }) => {
      try {
        const stmt = db.prepare(
          'INSERT INTO todos (title, description, completed) VALUES (?, ?, ?)'
        );
        const result = stmt.run(title, description || null, 0);

        return {
          id: result.lastInsertRowid,
          title,
          description,
          completed: false,
        };
      } catch (error) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create todo',
        });
      }
    },
  }),
};
```

#### Read Action (List)
```typescript
getTodos: defineAction({
  input: z.object({
    completed: z.boolean().optional(),
    limit: z.number().min(1).max(100).default(20),
    offset: z.number().min(0).default(0),
  }),
  handler: async ({ completed, limit, offset }) => {
    let query = 'SELECT * FROM todos';
    const params: any[] = [];

    if (completed !== undefined) {
      query += ' WHERE completed = ?';
      params.push(completed ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const todos = stmt.all(...params);

    return { todos, limit, offset };
  },
}),
```

#### Read Action (Single)
```typescript
getTodo: defineAction({
  input: z.object({
    id: z.number(),
  }),
  handler: async ({ id }) => {
    const stmt = db.prepare('SELECT * FROM todos WHERE id = ?');
    const todo = stmt.get(id);

    if (!todo) {
      throw new ActionError({
        code: 'NOT_FOUND',
        message: 'Todo not found',
      });
    }

    return todo;
  },
}),
```

#### Update Action
```typescript
updateTodo: defineAction({
  input: z.object({
    id: z.number(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().optional(),
    completed: z.boolean().optional(),
  }),
  handler: async ({ id, title, description, completed }) => {
    // First check if exists
    const existing = db.prepare('SELECT id FROM todos WHERE id = ?').get(id);
    if (!existing) {
      throw new ActionError({
        code: 'NOT_FOUND',
        message: 'Todo not found',
      });
    }

    // Build dynamic update query
    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (completed !== undefined) {
      updates.push('completed = ?');
      params.push(completed ? 1 : 0);
    }

    if (updates.length === 0) {
      throw new ActionError({
        code: 'BAD_REQUEST',
        message: 'No fields to update',
      });
    }

    params.push(id);
    const stmt = db.prepare(
      `UPDATE todos SET ${updates.join(', ')} WHERE id = ?`
    );
    stmt.run(...params);

    // Return updated todo
    return db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  },
}),
```

#### Delete Action
```typescript
deleteTodo: defineAction({
  input: z.object({
    id: z.number(),
  }),
  handler: async ({ id }) => {
    const stmt = db.prepare('DELETE FROM todos WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new ActionError({
        code: 'NOT_FOUND',
        message: 'Todo not found',
      });
    }

    return { success: true };
  },
}),
```

### Advanced Patterns

#### Search and Filter
```typescript
searchTodos: defineAction({
  input: z.object({
    query: z.string().min(1),
    completed: z.boolean().optional(),
  }),
  handler: async ({ query, completed }) => {
    let sql = 'SELECT * FROM todos WHERE title LIKE ? OR description LIKE ?';
    const params: any[] = [`%${query}%`, `%${query}%`];

    if (completed !== undefined) {
      sql += ' AND completed = ?';
      params.push(completed ? 1 : 0);
    }

    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },
}),
```

#### Batch Operations
```typescript
batchUpdateTodos: defineAction({
  input: z.object({
    ids: z.array(z.number()).min(1).max(100),
    completed: z.boolean(),
  }),
  handler: async ({ ids, completed }) => {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(
      `UPDATE todos SET completed = ? WHERE id IN (${placeholders})`
    );
    const result = stmt.run(completed ? 1 : 0, ...ids);

    return { updated: result.changes };
  },
}),
```

#### Transaction Example
```typescript
import Database from 'better-sqlite3';

transferTodo: defineAction({
  input: z.object({
    todoId: z.number(),
    fromUserId: z.number(),
    toUserId: z.number(),
  }),
  handler: async ({ todoId, fromUserId, toUserId }) => {
    const transaction = db.transaction(() => {
      // Verify ownership
      const todo = db.prepare(
        'SELECT * FROM todos WHERE id = ? AND user_id = ?'
      ).get(todoId, fromUserId);

      if (!todo) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: 'Todo not found or not owned by user',
        });
      }

      // Transfer ownership
      db.prepare('UPDATE todos SET user_id = ? WHERE id = ?')
        .run(toUserId, todoId);

      // Log the transfer
      db.prepare(
        'INSERT INTO transfer_logs (todo_id, from_user_id, to_user_id) VALUES (?, ?, ?)'
      ).run(todoId, fromUserId, toUserId);
    });

    transaction();
    return { success: true };
  },
}),
```

### Error Handling Best Practices

```typescript
// Always use ActionError with appropriate codes
throw new ActionError({
  code: 'NOT_FOUND',           // Item doesn't exist
  code: 'BAD_REQUEST',          // Invalid input
  code: 'UNAUTHORIZED',         // Not logged in
  code: 'FORBIDDEN',            // Logged in but no permission
  code: 'INTERNAL_SERVER_ERROR', // Unexpected error
  code: 'TOO_MANY_REQUESTS',    // Rate limit
  message: 'User-friendly error message', // No sensitive data!
});

// Catch database errors
try {
  // database operation
} catch (error) {
  console.error('Database error:', error);
  throw new ActionError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An error occurred', // Generic message, log details server-side
  });
}
```

---

## Database Design Patterns

### Schema Planning

**Before writing any database code, plan your schema:**

1. **Identify entities** (nouns: User, Post, Comment, Like)
2. **Define relationships** (one-to-many, many-to-many)
3. **Choose data types** (INTEGER, TEXT, REAL, BLOB)
4. **Add constraints** (PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL)
5. **Consider indexes** (for frequently queried columns)

### Common Schema Patterns

#### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

#### Posts/Articles Table
```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  published BOOLEAN DEFAULT 0,
  published_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_published ON posts(published);
```

#### Comments Table (One-to-Many)
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
```

#### Tags Table (Many-to-Many)
```sql
-- Tags
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

-- Junction table
CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX idx_post_tags_tag_id ON post_tags(tag_id);
```

#### Categories Table (Hierarchical)
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0
);

CREATE INDEX idx_categories_parent_id ON categories(parent_id);
```

### Database Setup Pattern

```typescript
// src/lib/db.ts
import Database from 'better-sqlite3';

const db = new Database('./data.db', { verbose: console.log });

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      completed BOOLEAN DEFAULT 0,
      due_date INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
  `);
}

initDatabase();

export { db };
```

### Migration Pattern

```typescript
// src/lib/db.ts
const SCHEMA_VERSION = 2;

function getCurrentVersion(): number {
  try {
    const row = db.prepare('SELECT version FROM schema_version').get() as any;
    return row?.version || 0;
  } catch {
    return 0;
  }
}

function migrate() {
  const currentVersion = getCurrentVersion();

  if (currentVersion < 1) {
    // Initial schema
    db.exec(`
      CREATE TABLE schema_version (version INTEGER);
      INSERT INTO schema_version (version) VALUES (1);

      CREATE TABLE users (...);
      CREATE TABLE todos (...);
    `);
  }

  if (currentVersion < 2) {
    // Add new column
    db.exec(`
      ALTER TABLE todos ADD COLUMN priority TEXT DEFAULT 'medium';
      UPDATE schema_version SET version = 2;
    `);
  }
}

migrate();
```

### Query Patterns

#### Pagination
```typescript
const limit = 20;
const offset = (page - 1) * limit;

const stmt = db.prepare(`
  SELECT * FROM posts
  WHERE published = 1
  ORDER BY published_at DESC
  LIMIT ? OFFSET ?
`);
const posts = stmt.all(limit, offset);

// Get total count
const countStmt = db.prepare('SELECT COUNT(*) as count FROM posts WHERE published = 1');
const { count } = countStmt.get() as any;
const totalPages = Math.ceil(count / limit);
```

#### Joins
```typescript
// Get posts with author info
const stmt = db.prepare(`
  SELECT
    posts.*,
    users.username,
    users.display_name,
    users.avatar_url
  FROM posts
  JOIN users ON posts.user_id = users.id
  WHERE posts.published = 1
  ORDER BY posts.published_at DESC
`);
const postsWithAuthors = stmt.all();
```

#### Aggregation
```typescript
// Get post count per user
const stmt = db.prepare(`
  SELECT
    users.id,
    users.username,
    COUNT(posts.id) as post_count
  FROM users
  LEFT JOIN posts ON users.id = posts.user_id
  GROUP BY users.id
  ORDER BY post_count DESC
`);
const userStats = stmt.all();
```

---

## Authentication & Authorization

### Password-Based Authentication

#### Registration Action
```typescript
import bcrypt from 'bcryptjs';

register: defineAction({
  input: z.object({
    email: z.string().email(),
    password: z.string().min(8).max(100),
    username: z.string().min(3).max(30),
  }),
  handler: async ({ email, password, username }) => {
    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      throw new ActionError({
        code: 'BAD_REQUEST',
        message: 'Email already registered',
      });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const stmt = db.prepare(
      'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)'
    );
    const result = stmt.run(email, username, password_hash);

    return {
      id: result.lastInsertRowid,
      email,
      username,
    };
  },
}),
```

#### Login Action
```typescript
login: defineAction({
  input: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
  handler: async ({ email, password }, context) => {
    // Find user
    const user = db.prepare(
      'SELECT id, email, username, password_hash FROM users WHERE email = ?'
    ).get(email) as any;

    if (!user) {
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    // Set session (using astro:session)
    context.session.set('userId', user.id);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
    };
  },
}),
```

#### Logout Action
```typescript
logout: defineAction({
  handler: async (_, context) => {
    context.session.destroy();
    return { success: true };
  },
}),
```

### Protected Routes (Middleware)

```typescript
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const userId = context.session.get('userId');

  // Protected routes
  const protectedPaths = ['/dashboard', '/settings', '/profile'];
  const isProtected = protectedPaths.some(path =>
    context.url.pathname.startsWith(path)
  );

  if (isProtected && !userId) {
    return Response.redirect(new URL('/login', context.url));
  }

  // Add user to context
  if (userId) {
    const user = db.prepare('SELECT id, email, username FROM users WHERE id = ?')
      .get(userId);
    context.locals.user = user;
  }

  return next();
});
```

### Authorization Patterns

#### Check Ownership
```typescript
updatePost: defineAction({
  input: z.object({
    postId: z.number(),
    title: z.string(),
  }),
  handler: async ({ postId, title }, context) => {
    const userId = context.session.get('userId');
    if (!userId) {
      throw new ActionError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    // Verify ownership
    const post = db.prepare('SELECT user_id FROM posts WHERE id = ?').get(postId) as any;
    if (!post) {
      throw new ActionError({ code: 'NOT_FOUND', message: 'Post not found' });
    }
    if (post.user_id !== userId) {
      throw new ActionError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to edit this post',
      });
    }

    // Update post
    db.prepare('UPDATE posts SET title = ? WHERE id = ?').run(title, postId);
    return { success: true };
  },
}),
```

#### Role-Based Access Control
```sql
-- Add role column to users
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';
-- Roles: 'user', 'admin', 'moderator'
```

```typescript
// Middleware check
export const onRequest = defineMiddleware(async (context, next) => {
  const userId = context.session.get('userId');

  if (userId) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    context.locals.user = user;
    context.locals.isAdmin = user.role === 'admin';
  }

  // Admin-only routes
  if (context.url.pathname.startsWith('/admin') && !context.locals.isAdmin) {
    return Response.redirect(new URL('/', context.url));
  }

  return next();
});
```

### OAuth Integration Pattern

```typescript
// Example with GitHub OAuth
import { OAuth2Client } from 'oslo/oauth2';

const github = new OAuth2Client({
  clientId: import.meta.env.GITHUB_CLIENT_ID,
  clientSecret: import.meta.env.GITHUB_CLIENT_SECRET,
  redirectUri: `${import.meta.env.PUBLIC_SITE_URL}/auth/github/callback`,
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
});

// Redirect to GitHub
githubLogin: defineAction({
  handler: async () => {
    const state = generateRandomState();
    const url = github.createAuthorizationURL(state, ['user:email']);

    return { url: url.toString(), state };
  },
}),

// Handle callback
githubCallback: defineAction({
  input: z.object({
    code: z.string(),
    state: z.string(),
  }),
  handler: async ({ code, state }, context) => {
    // Verify state
    // Exchange code for token
    // Fetch user info from GitHub API
    // Create or update user in database
    // Set session

    return { success: true };
  },
}),
```

---

## Data Persistence Strategies

### Decision Matrix

| Need | Storage | Size Limit | Server Access | Multi-User | Best For |
|------|---------|------------|---------------|------------|----------|
| None | - | - | No | No | Static sites, calculators |
| Client-side only | localStorage | 5-10MB | No | No | Preferences, drafts, UI state |
| Server-side | SQLite | Unlimited | Yes | Yes | Apps with auth, CMS, e-commerce |

### localStorage Pattern

```tsx
'use client';
import { useState, useEffect } from 'react';

export function Counter() {
  const [count, setCount] = useState(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('counter');
      return saved ? parseInt(saved) : 0;
    }
    return 0;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('counter', count.toString());
  }, [count]);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
```

### localStorage with JSON Objects

```tsx
interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('todos');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = (title: string) => {
    setTodos([...todos, {
      id: crypto.randomUUID(),
      title,
      completed: false,
    }]);
  };

  // ... rest of component
}
```

### SQLite Setup (Full Example)

```bash
# Install dependencies
pnpm add better-sqlite3
pnpm add -D @types/better-sqlite3
```

```typescript
// src/lib/db.ts
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
`);

export { db };
```

```typescript
// src/actions/index.ts
import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { db } from '@/lib/db';

export const server = {
  createTodo: defineAction({
    input: z.object({ title: z.string() }),
    handler: async ({ title }, context) => {
      const userId = context.session.get('userId');
      const stmt = db.prepare('INSERT INTO todos (user_id, title) VALUES (?, ?)');
      const result = stmt.run(userId, title);
      return { id: result.lastInsertRowid };
    },
  }),

  getTodos: defineAction({
    handler: async (_, context) => {
      const userId = context.session.get('userId');
      const stmt = db.prepare('SELECT * FROM todos WHERE user_id = ?');
      return stmt.all(userId);
    },
  }),
};
```

---

## Performance Optimization

### Image Optimization

```astro
---
import { Image } from 'astro:assets';
import myImage from '@/assets/hero.jpg';
---

<!-- Optimized with Astro's Image component -->
<Image
  src={myImage}
  alt="Hero image"
  width={1200}
  height={600}
  loading="lazy"
  format="webp"
/>

<!-- Responsive images -->
<Image
  src={myImage}
  alt="Hero"
  widths={[400, 800, 1200]}
  sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
/>
```

### Lazy Loading Components

```astro
---
// Heavy chart component - only load when visible
import Chart from '@/components/Chart';
---

<Chart client:visible />
```

### Code Splitting

```tsx
import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';

// Dynamically import heavy component
const HeavyChart = lazy(() => import('@/components/HeavyChart'));

export function Dashboard() {
  return (
    <Suspense fallback={<Spinner />}>
      <HeavyChart />
    </Suspense>
  );
}
```

### Caching Strategies

#### Action-Level Caching
```typescript
const cache = new Map();

getExpensiveData: defineAction({
  handler: async () => {
    const cacheKey = 'expensive-data';

    if (cache.has(cacheKey)) {
      const { data, timestamp } = cache.get(cacheKey);
      // Cache for 5 minutes
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        return data;
      }
    }

    const data = await performExpensiveOperation();
    cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  },
}),
```

#### Client-Side Caching
```tsx
import { useState, useEffect } from 'react';

export function useData(key: string) {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Check localStorage cache first
    const cached = localStorage.getItem(key);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 5 * 60 * 1000) {
        setData(data);
        return;
      }
    }

    // Fetch fresh data
    actions.getData().then(result => {
      setData(result.data);
      localStorage.setItem(key, JSON.stringify({
        data: result.data,
        timestamp: Date.now(),
      }));
    });
  }, [key]);

  return data;
}
```

### Database Optimization

```typescript
// Add indexes for frequently queried columns
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
`);

// Use prepared statements (reusable)
const getPostsByUser = db.prepare('SELECT * FROM posts WHERE user_id = ?');

// Batch operations
const insertMany = db.transaction((posts) => {
  const insert = db.prepare('INSERT INTO posts (title, content) VALUES (?, ?)');
  for (const post of posts) {
    insert.run(post.title, post.content);
  }
});
```

---

## Security Best Practices

### Input Validation

```typescript
// ALWAYS use Zod schemas
input: z.object({
  email: z.string().email().max(255),
  age: z.number().int().min(0).max(120),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional(),
}),
```

### SQL Injection Prevention

```typescript
// ❌ NEVER concatenate user input
const query = `SELECT * FROM users WHERE email = '${email}'`; // VULNERABLE!

// ✅ ALWAYS use parameterized queries
const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
const user = stmt.get(email);

// ✅ For IN clauses
const placeholders = ids.map(() => '?').join(',');
const stmt = db.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`);
const users = stmt.all(...ids);
```

### XSS Prevention

```tsx
// React automatically escapes strings
<p>{userInput}</p> // Safe

// ❌ NEVER use dangerouslySetInnerHTML with user input
<div dangerouslySetInnerHTML={{ __html: userInput }} /> // VULNERABLE!

// ✅ If you MUST render HTML, sanitize it first
import DOMPurify from 'isomorphic-dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### Password Security

```typescript
import bcrypt from 'bcryptjs';

// Hashing (registration)
const password_hash = await bcrypt.hash(password, 10); // 10 rounds

// Verification (login)
const valid = await bcrypt.compare(password, password_hash);
```

### Environment Variables

```typescript
// ❌ NEVER expose secrets to client
const API_KEY = import.meta.env.PUBLIC_API_KEY; // Anyone can see this!

// ✅ Keep secrets server-side only (no PUBLIC_ prefix)
const API_KEY = import.meta.env.SECRET_API_KEY; // Only available in actions

// Example
export const server = {
  fetchData: defineAction({
    handler: async () => {
      const response = await fetch('https://api.example.com', {
        headers: {
          'Authorization': `Bearer ${import.meta.env.SECRET_API_KEY}`,
        },
      });
      return response.json();
    },
  }),
};
```

### CORS Configuration

```typescript
// src/middleware.ts
export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  // Set CORS headers for API routes
  if (context.url.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', 'https://yourdomain.com');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
});
```

### Rate Limiting

```typescript
const rateLimits = new Map<string, { count: number, resetAt: number }>();

function checkRateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimits.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimits.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

// Usage in action
export const server = {
  sendEmail: defineAction({
    input: z.object({ email: z.string().email() }),
    handler: async ({ email }, context) => {
      const ip = context.request.headers.get('x-forwarded-for') || 'unknown';

      // 5 requests per minute
      if (!checkRateLimit(ip, 5, 60000)) {
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests. Please try again later.',
        });
      }

      // Send email...
    },
  }),
};
```

---

## Accessibility Guidelines

### Semantic HTML

```astro
<!-- ✅ Good: Semantic elements -->
<header>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>Page Title</h1>
    <section>
      <h2>Section Title</h2>
      <p>Content...</p>
    </section>
  </article>
</main>

<footer>
  <p>&copy; 2024 Company Name</p>
</footer>

<!-- ❌ Bad: Divs for everything -->
<div class="header">
  <div class="nav">...</div>
</div>
```

### ARIA Labels

```tsx
// Buttons with icons only
<button aria-label="Close dialog">
  <X className="w-4 h-4" />
</button>

// Form fields
<Label htmlFor="email">Email Address</Label>
<Input
  id="email"
  type="email"
  aria-describedby="email-error"
  aria-invalid={!!error}
/>
{error && <span id="email-error" className="text-red-600">{error}</span>}

// Loading states
<button disabled={loading} aria-busy={loading}>
  {loading ? 'Submitting...' : 'Submit'}
</button>

// Live regions for dynamic content
<div aria-live="polite" aria-atomic="true">
  {successMessage}
</div>
```

### Keyboard Navigation

```tsx
// Ensure all interactive elements are keyboard accessible
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Click me
</div>

// Focus management in dialogs
import { useEffect, useRef } from 'react';

export function Dialog({ open }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  return (
    <div role="dialog" aria-modal="true">
      <button ref={closeButtonRef}>Close</button>
    </div>
  );
}
```

### Focus Indicators

```css
/* Never remove focus outlines without replacement */
/* ❌ Bad */
button:focus {
  outline: none;
}

/* ✅ Good */
button:focus-visible {
  outline: 2px solid blue;
  outline-offset: 2px;
}
```

### Screen Reader Text

```tsx
// Visually hidden but available to screen readers
<span className="sr-only">
  Navigate to homepage
</span>

// In Tailwind
<span className="sr-only">
  Loading...
</span>
```

### Color Contrast

Ensure minimum contrast ratios:
- Normal text: 4.5:1
- Large text (18pt+): 3:1
- UI components: 3:1

```tsx
// ✅ Good contrast
<p className="text-gray-900 bg-white">Content</p>
<p className="text-white bg-gray-900">Content</p>

// ❌ Poor contrast
<p className="text-gray-400 bg-white">Content</p>
```

---

## Third-Party Integrations

### Stripe Payments

```bash
pnpm add stripe
```

```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});
```

```typescript
// Create checkout session
createCheckoutSession: defineAction({
  input: z.object({
    priceId: z.string(),
  }),
  handler: async ({ priceId }, context) => {
    const userId = context.session.get('userId');
    if (!userId) {
      throw new ActionError({ code: 'UNAUTHORIZED' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${import.meta.env.PUBLIC_SITE_URL}/success`,
      cancel_url: `${import.meta.env.PUBLIC_SITE_URL}/pricing`,
      client_reference_id: userId.toString(),
    });

    return { url: session.url };
  },
}),

// Webhook handler
// src/pages/api/webhooks/stripe.ts
export async function POST({ request }) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    import.meta.env.STRIPE_WEBHOOK_SECRET
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;

    // Update user subscription in database
    db.prepare('UPDATE users SET subscription_status = ? WHERE id = ?')
      .run('active', userId);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

### Email (Resend)

```bash
pnpm add resend
```

```typescript
import { Resend } from 'resend';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

sendEmail: defineAction({
  input: z.object({
    to: z.string().email(),
    subject: z.string(),
    html: z.string(),
  }),
  handler: async ({ to, subject, html }) => {
    const { data, error } = await resend.emails.send({
      from: 'noreply@yourdomain.com',
      to,
      subject,
      html,
    });

    if (error) {
      throw new ActionError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to send email',
      });
    }

    return { success: true, id: data.id };
  },
}),
```

### OAuth (Google)

```typescript
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client({
  clientId: import.meta.env.GOOGLE_CLIENT_ID,
  clientSecret: import.meta.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `${import.meta.env.PUBLIC_SITE_URL}/auth/google/callback`,
});

googleLogin: defineAction({
  handler: async () => {
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: ['email', 'profile'],
    });
    return { url };
  },
}),

googleCallback: defineAction({
  input: z.object({ code: z.string() }),
  handler: async ({ code }, context) => {
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: import.meta.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(payload.email);

    if (!user) {
      const stmt = db.prepare(
        'INSERT INTO users (email, username, display_name, avatar_url) VALUES (?, ?, ?, ?)'
      );
      const result = stmt.run(
        payload.email,
        payload.email.split('@')[0],
        payload.name,
        payload.picture
      );
      user = { id: result.lastInsertRowid };
    }

    context.session.set('userId', user.id);
    return { success: true };
  },
}),
```

---

## File Upload Patterns

### Client-Side Upload

```tsx
'use client';
import { useState } from 'react';
import { actions } from 'astro:actions';
import { Button } from '@/components/ui/button';

export function ImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File must be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const { data, error } = await actions.uploadImage(formData);
    setUploading(false);

    if (error) {
      alert(error.message);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {preview && <img src={preview} alt="Preview" className="mt-4 max-w-xs" />}
      {uploading && <p>Uploading...</p>}
    </div>
  );
}
```

### Server-Side Upload Handler

```typescript
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

uploadImage: defineAction({
  input: z.object({
    file: z.instanceof(File),
  }),
  handler: async ({ file }, context) => {
    const userId = context.session.get('userId');
    if (!userId) {
      throw new ActionError({ code: 'UNAUTHORIZED' });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new ActionError({
        code: 'BAD_REQUEST',
        message: 'File must be an image',
      });
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new ActionError({
        code: 'BAD_REQUEST',
        message: 'File must be less than 5MB',
      });
    }

    // Generate unique filename
    const ext = path.extname(file.name);
    const filename = `${crypto.randomUUID()}${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filepath = path.join(uploadDir, filename);

    // Ensure upload directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;

    // Save to database
    db.prepare('INSERT INTO uploads (user_id, filename, url) VALUES (?, ?, ?)')
      .run(userId, filename, url);

    return { url };
  },
}),
```

---

## Real-time Features

### Server-Sent Events (SSE)

```typescript
// src/pages/api/events.ts
export async function GET({ request }) {
  const userId = request.headers.get('x-user-id');

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));

      // Send updates every 5 seconds
      const interval = setInterval(() => {
        const data = { type: 'update', timestamp: Date.now() };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }, 5000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

```tsx
// Client-side SSE consumer
'use client';
import { useEffect, useState } from 'react';

export function LiveUpdates() {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, data]);
    };

    eventSource.onerror = () => {
      console.error('SSE error');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>{JSON.stringify(msg)}</div>
      ))}
    </div>
  );
}
```

### Polling Strategy

```tsx
'use client';
import { useEffect, useState } from 'react';
import { actions } from 'astro:actions';

export function PollingComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const result = await actions.getData();
      if (result.data) {
        setData(result.data);
      }
    };

    // Initial fetch
    fetchData();

    // Poll every 10 seconds
    const interval = setInterval(fetchData, 10000);

    return () => clearInterval(interval);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

### Optimistic Updates

```tsx
'use client';
import { useState } from 'react';
import { actions } from 'astro:actions';

export function TodoList() {
  const [todos, setTodos] = useState([]);

  const toggleTodo = async (id: number) => {
    // Optimistically update UI
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));

    // Send to server
    const { error } = await actions.toggleTodo({ id });

    // Revert on error
    if (error) {
      setTodos(prev => prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      ));
    }
  };

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => toggleTodo(todo.id)}
          />
          {todo.title}
        </li>
      ))}
    </ul>
  );
}
```

---

## Testing Strategies

### Action Testing with curl

```bash
# Test GET action (no input)
curl -X POST http://localhost:4321/_actions/getTodos

# Test POST action with input
curl -X POST http://localhost:4321/_actions/createTodo \
  -H "Content-Type: application/json" \
  -d '{"title":"Test todo"}'

# Test with authentication (session cookie)
curl -X POST http://localhost:4321/_actions/getProfile \
  -H "Cookie: session=your-session-token"

# Test error handling
curl -X POST http://localhost:4321/_actions/getTodo \
  -H "Content-Type: application/json" \
  -d '{"id":999999}'
```

### Manual Testing Checklist

**Forms:**
- [ ] Submit with valid data
- [ ] Submit with invalid data (empty, wrong format)
- [ ] Submit while already submitting (loading state)
- [ ] Check error messages are clear
- [ ] Verify success feedback

**Responsive Design:**
- [ ] Test on mobile (320px width)
- [ ] Test on tablet (768px width)
- [ ] Test on desktop (1920px width)
- [ ] Check navigation works on all sizes

**Accessibility:**
- [ ] Tab through all interactive elements
- [ ] Test with screen reader
- [ ] Check color contrast
- [ ] Verify ARIA labels

**Performance:**
- [ ] Check Lighthouse score
- [ ] Test with slow 3G network
- [ ] Verify images are optimized
- [ ] Check for console errors

---

## Complete Application Blueprints

### 1. Todo App with Authentication

**Features**: User registration, login, personal todo lists, mark complete, filter by status

**Database Schema**:
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT 0,
  due_date INTEGER,
  priority TEXT DEFAULT 'medium',
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_completed ON todos(completed);
```

**File Structure**:
```
src/
├── actions/
│   └── index.ts           # register, login, logout, CRUD todos
├── lib/
│   └── db.ts              # SQLite setup
├── middleware.ts          # Protected routes
├── components/
│   ├── TodoList.tsx       # Main todo component
│   ├── TodoItem.tsx       # Individual todo
│   ├── AddTodoForm.tsx    # Create todo form
│   └── AuthForm.tsx       # Login/register
└── pages/
    ├── index.astro        # Landing page
    ├── login.astro        # Auth page
    └── dashboard.astro    # Protected todo list
```

**Key Actions**:
```typescript
export const server = {
  register: defineAction({ /* ... */ }),
  login: defineAction({ /* ... */ }),
  logout: defineAction({ /* ... */ }),
  createTodo: defineAction({ /* ... */ }),
  getTodos: defineAction({ /* filter by completed */ }),
  updateTodo: defineAction({ /* title, description, completed, due_date */ }),
  deleteTodo: defineAction({ /* ... */ }),
};
```

---

### 2. Blog with CMS

**Features**: Public blog posts, admin panel, markdown support, categories, search

**Database Schema**:
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user'
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image TEXT,
  published BOOLEAN DEFAULT 0,
  published_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE post_categories (
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);

CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_published ON posts(published);
```

**File Structure**:
```
src/
├── actions/
│   ├── index.ts           # Public actions (getPosts, getPost)
│   └── admin.ts           # Admin actions (createPost, updatePost, delete)
├── pages/
│   ├── index.astro        # Homepage with latest posts
│   ├── blog/
│   │   ├── [slug].astro   # Individual post
│   │   └── category/
│   │       └── [slug].astro
│   └── admin/
│       ├── dashboard.astro
│       ├── posts/
│       │   ├── index.astro
│       │   ├── new.astro
│       │   └── [id]/edit.astro
│       └── categories.astro
└── components/
    ├── PostCard.tsx
    ├── PostEditor.tsx     # Markdown editor
    └── CategoryFilter.tsx
```

**Key Actions**:
```typescript
// Public
getPosts: defineAction({ /* pagination, category filter */ }),
getPost: defineAction({ /* by slug */ }),
searchPosts: defineAction({ /* full-text search */ }),

// Admin (role-protected)
createPost: defineAction({ /* title, content, categories */ }),
updatePost: defineAction({ /* ... */ }),
deletePost: defineAction({ /* ... */ }),
publishPost: defineAction({ /* set published = true */ }),
```

---

### 3. E-commerce Store

**Features**: Product catalog, shopping cart, Stripe checkout, order history

**Database Schema**:
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  stripe_session_id TEXT UNIQUE,
  total INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price INTEGER NOT NULL
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
```

**File Structure**:
```
src/
├── actions/
│   └── index.ts           # Products, cart, checkout
├── pages/
│   ├── index.astro        # Homepage
│   ├── products/
│   │   ├── index.astro    # Product listing
│   │   └── [slug].astro   # Product detail
│   ├── cart.astro
│   ├── checkout.astro
│   └── orders/
│       └── [id].astro
└── components/
    ├── ProductCard.tsx
    ├── CartItem.tsx
    └── CheckoutForm.tsx
```

**Key Actions**:
```typescript
getProducts: defineAction({ /* pagination, search */ }),
getProduct: defineAction({ /* by slug */ }),
addToCart: defineAction({ /* localStorage on client */ }),
createCheckoutSession: defineAction({ /* Stripe integration */ }),
getOrders: defineAction({ /* user's order history */ }),
```

**Stripe Webhook**:
```typescript
// src/pages/api/webhooks/stripe.ts
export async function POST({ request }) {
  const event = await verifyStripeWebhook(request);

  if (event.type === 'checkout.session.completed') {
    // Mark order as paid
    // Send confirmation email
  }

  return new Response(JSON.stringify({ received: true }));
}
```

---

### 4. Analytics Dashboard

**Features**: Data visualization, real-time metrics, export reports

**Database Schema**:
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id INTEGER,
  properties TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  value REAL NOT NULL,
  timestamp INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_metrics_name ON metrics(metric_name);
```

**File Structure**:
```
src/
├── actions/
│   └── index.ts           # getMetrics, getEvents, exportData
├── pages/
│   ├── index.astro        # Dashboard overview
│   ├── analytics/
│   │   ├── events.astro
│   │   └── metrics.astro
│   └── api/
│       └── events.ts      # SSE for real-time updates
└── components/
    ├── LineChart.tsx      # recharts
    ├── BarChart.tsx
    ├── MetricCard.tsx
    └── EventsTable.tsx
```

**Key Actions**:
```typescript
getMetrics: defineAction({
  input: z.object({
    metric: z.string(),
    startDate: z.number(),
    endDate: z.number(),
  }),
  handler: async ({ metric, startDate, endDate }) => {
    const stmt = db.prepare(`
      SELECT * FROM metrics
      WHERE metric_name = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(metric, startDate, endDate);
  },
}),

trackEvent: defineAction({
  input: z.object({
    eventType: z.string(),
    properties: z.record(z.any()).optional(),
  }),
  handler: async ({ eventType, properties }, context) => {
    const userId = context.session.get('userId');
    db.prepare('INSERT INTO events (event_type, user_id, properties) VALUES (?, ?, ?)')
      .run(eventType, userId, JSON.stringify(properties));
    return { success: true };
  },
}),
```

---

### 5. SaaS Template

**Features**: User registration, subscription plans (Stripe), team management, usage tracking

**Database Schema**:
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  stripe_customer_id TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end INTEGER NOT NULL
);

CREATE TABLE teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE team_members (
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  resource TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL
);
```

**File Structure**:
```
src/
├── actions/
│   ├── auth.ts            # register, login
│   ├── subscription.ts    # createCheckout, cancelSubscription
│   └── teams.ts           # create, invite, remove members
├── pages/
│   ├── index.astro        # Landing page
│   ├── pricing.astro      # Plans
│   ├── dashboard.astro    # Main app
│   ├── settings/
│   │   ├── account.astro
│   │   ├── billing.astro
│   │   └── team.astro
│   └── api/
│       └── webhooks/
│           └── stripe.ts
└── components/
    ├── PricingCard.tsx
    ├── TeamMembers.tsx
    └── UsageChart.tsx
```

**Key Actions**:
```typescript
createCheckoutSession: defineAction({
  input: z.object({ planId: z.string() }),
  handler: async ({ planId }, context) => {
    const userId = context.session.get('userId');
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: planId, quantity: 1 }],
      client_reference_id: userId.toString(),
      /* ... */
    });
    return { url: session.url };
  },
}),

cancelSubscription: defineAction({ /* ... */ }),

createTeam: defineAction({
  input: z.object({ name: z.string() }),
  handler: async ({ name }, context) => {
    const userId = context.session.get('userId');
    const stmt = db.prepare('INSERT INTO teams (name, owner_id) VALUES (?, ?)');
    const result = stmt.run(name, userId);
    return { id: result.lastInsertRowid };
  },
}),

inviteTeamMember: defineAction({
  input: z.object({ teamId: z.number(), email: z.string().email() }),
  handler: async ({ teamId, email }, context) => {
    // Verify user is team owner
    // Send invitation email
    // Create pending invitation record
  },
}),
```

---

## Debugging & Troubleshooting

### Common Issues

#### Build Errors
```bash
# Check imports
pnpm build

# Common causes:
# - Missing imports
# - Wrong file paths
# - Type errors
# - Circular dependencies
```

#### Action Not Working
```bash
# Test action directly with curl
curl -X POST http://localhost:4321/_actions/myAction \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'

# Check:
# - Is action exported in src/actions/index.ts?
# - Is input schema correct?
# - Are there console errors?
# - Is the database file accessible?
```

#### Type Errors
```bash
# Check TypeScript
pnpm tsc --noEmit

# Common causes:
# - Missing type imports
# - Incorrect prop types
# - Any vs unknown confusion
```

#### Preview Not Updating
```bash
# Check Docker logs
docker logs doce-preview-{projectId}

# Restart container if needed
docker restart doce-preview-{projectId}

# Check browser console for errors
```

#### Database Locked
```sql
-- Check WAL mode is enabled
PRAGMA journal_mode;  -- Should return 'wal'

-- Enable if not
PRAGMA journal_mode = WAL;
```

### Debugging Tips

**Enable Verbose SQL Logging**:
```typescript
const db = new Database('./data.db', { verbose: console.log });
```

**Add Action Logging**:
```typescript
handler: async (input, context) => {
  console.log('Action called with:', input);
  console.log('User:', context.session.get('userId'));

  try {
    const result = /* ... */;
    console.log('Action result:', result);
    return result;
  } catch (error) {
    console.error('Action error:', error);
    throw error;
  }
}
```

**Check Network Tab**:
- Open browser DevTools → Network
- Filter by `_actions`
- Check request/response payloads
- Look for error codes

---

## Quick Reference

### Essential Commands
```bash
pnpm install                          # Install dependencies
pnpm add <package>                    # Add package
pnpm dlx shadcn@latest add button     # Add shadcn component
pnpm dlx shadcn@latest add @svgl/icon # Add icon
pnpm build                            # Build for production
```

### Action Template
```typescript
export const server = {
  myAction: defineAction({
    input: z.object({
      field: z.string(),
    }),
    handler: async ({ field }, context) => {
      const userId = context.session.get('userId');
      // Logic here
      return { success: true };
    },
  }),
};
```

### Component Template
```tsx
'use client';
import { useState } from 'react';
import { actions } from 'astro:actions';
import { Button } from '@/components/ui/button';

export function MyComponent() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const { data, error } = await actions.myAction({ field: 'value' });
    setLoading(false);

    if (error) {
      console.error(error);
      return;
    }

    // Success
  };

  return <Button onClick={handleClick} disabled={loading}>Click</Button>;
}
```

### Database Query Template
```typescript
// Insert
const stmt = db.prepare('INSERT INTO table (col) VALUES (?)');
const result = stmt.run(value);
const id = result.lastInsertRowid;

// Select one
const stmt = db.prepare('SELECT * FROM table WHERE id = ?');
const row = stmt.get(id);

// Select many
const stmt = db.prepare('SELECT * FROM table WHERE col = ?');
const rows = stmt.all(value);

// Update
const stmt = db.prepare('UPDATE table SET col = ? WHERE id = ?');
const result = stmt.run(newValue, id);

// Delete
const stmt = db.prepare('DELETE FROM table WHERE id = ?');
const result = stmt.run(id);
```

### Error Codes Reference
- `NOT_FOUND` - Resource doesn't exist
- `BAD_REQUEST` - Invalid input
- `UNAUTHORIZED` - Not logged in
- `FORBIDDEN` - No permission
- `INTERNAL_SERVER_ERROR` - Unexpected error
- `TOO_MANY_REQUESTS` - Rate limited

### Responsive Breakpoints
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px
- `2xl:` - 1536px

---

## Rules Summary

### DO ✅
- Use Astro 5 with React islands
- Generate complete, working code
- Use shadcn/ui components
- Use Astro Actions for server logic
- Validate with Zod schemas
- Handle loading/error states
- Mobile-first responsive design
- Semantic HTML + ARIA labels
- Keep functions small (<20 lines)
- Use prepared statements for SQL
- Hash passwords with bcrypt
- Test actions with curl

### DON'T ❌
- Reference Next.js APIs
- Regenerate config files
- Use `fetch()` for internal APIs
- Use API routes for CRUD (use Actions)
- Create unstyled components
- Use inline styles or custom CSS
- Concatenate SQL with user input
- Expose secrets to client
- Use `dangerouslySetInnerHTML` with user input
- Remove focus outlines without replacement
- Run `pnpm run dev` (already running in Docker)

---

**Version**: 1.0
**Last Updated**: 2024-11-10
**Stack**: Astro 5 + React 19 + Tailwind v4 + SQLite + Docker
