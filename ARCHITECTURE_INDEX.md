# Architecture Documentation Index

## Overview

This directory contains comprehensive architectural documentation for the doce.dev project. Start here to understand the codebase.

## Documents

### 1. CODEBASE_ARCHITECTURE.md (18 KB)
**Comprehensive deep-dive into the entire architecture**

Best for: Understanding the complete system, tech stack verification, patterns

Covers:
- Tech stack with versions and configuration
- Complete project file structure with paths
- Database schema (7 tables, 9 migrations)
- Key implementation patterns:
  - Astro Actions (server operations)
  - Queue System (sophisticated job orchestration)
  - Presence System (container lifecycle)
  - OpenCode Proxy
  - Authentication (DB-backed sessions)
  - Middleware flow
  - Project template system
  - Data flows (project creation, etc.)
- Architectural strengths and patterns
- Production readiness assessment
- Code statistics

**Read this first** if you want a complete understanding of the system.

### 2. ARCHITECTURE_QUICK_REFERENCE.md (7 KB)
**Quick lookup guide for common development tasks**

Best for: Development workflow, debugging, quick answers

Covers:
- Common tasks (add page, action, queue job, component)
- Data flow patterns
- Key constants (timeouts, intervals)
- Important modules
- Testing tips
- Environment variables
- Common issues and solutions
- Development commands

**Read this** before you start coding to know where things go.

### 3. IMPLEMENTATION_STATUS.md (10 KB)
**Feature completeness and discrepancies from documentation**

Best for: Knowing what's built, what's not, and what differs from docs

Covers:
- Tech stack implementation status (all done)
- UI architecture (all done)
- Server operations (all done)
- Project lifecycle (all done)
- Queue system (all done)
- Presence system (all done)
- OpenCode integration (all done)
- Database (all done)
- Known discrepancies from AGENTS.md (minor)
- Features from README.md to-do (13 not implemented)
- Code quality assessment
- Recommendations for future work

**Read this** to understand what's complete and plan next features.

### 4. AGENTS.md (8 KB)
**Original requirements and architectural decisions**

Contains:
- Project mission statement
- Rules for agentic development
- Clean code principles
- Architecture overview
- UI overview
- Features description

**Reference this** when making architectural decisions.

### 5. README.md (1.2 KB)
**High-level project description and to-do list**

Contains:
- Project tagline
- To-do items (13 features not yet implemented)

**Read this** for project vision and future plans.

---

## Quick Start Paths

### I just arrived at this project
1. Read the **Overview** section below (5 min)
2. Read **CODEBASE_ARCHITECTURE.md** sections 1-3 (10 min)
3. Skim **ARCHITECTURE_QUICK_REFERENCE.md** (5 min)
4. You're ready to explore the code!

### I need to understand a specific area
- **Database**: CODEBASE_ARCHITECTURE.md section 3
- **Queue System**: CODEBASE_ARCHITECTURE.md section 4.2
- **Container Lifecycle**: CODEBASE_ARCHITECTURE.md section 4.3
- **Authentication**: CODEBASE_ARCHITECTURE.md section 4.5
- **Component Structure**: CODEBASE_ARCHITECTURE.md section 2 (Project Structure)

### I'm ready to code
1. Check **ARCHITECTURE_QUICK_REFERENCE.md** for your task
2. Follow the suggested folder structure
3. Refer back to **CODEBASE_ARCHITECTURE.md** for patterns

### I need to debug something
1. Check **ARCHITECTURE_QUICK_REFERENCE.md** "Common Issues"
2. Check **ARCHITECTURE_QUICK_REFERENCE.md** "Testing Tips"
3. Use the key file locations to find relevant code

---

## System Overview

### What is doce.dev?
A self-hosted AI website builder where users can:
1. Create a project by describing their website in natural language
2. Watch as AI builds the initial website in a Docker container
3. Chat with the AI to refine and modify the website
4. Preview the website in real-time

### Tech Stack at a Glance
- **Frontend**: Astro 5, React 19, Tailwind v4 CSS variables, shadcn/ui
- **Backend**: Node.js, Astro Actions, TypeScript
- **Database**: SQLite with Drizzle ORM
- **Background Jobs**: In-process queue with 11 job types
- **Container Lifecycle**: Presence-based auto-start/stop
- **Logging**: Structured logging with Pino
- **Package Manager**: pnpm

### Key Numbers
- ~12,000 lines of code
- 7 database tables
- 9 migrations (versioned)
- 35+ React components
- 11 queue job types
- 30+ server actions
- 4 main API routes
- 8/10 code quality score

### Architecture Highlights
1. **Queue System**: Sophisticated with retries, deduplication, locking
2. **Presence System**: Elegant auto-start/stop based on user viewing
3. **Type Safety**: Full TypeScript, Zod validation, strict mode
4. **Clean Separation**: Models, actions, components in distinct domains
5. **Production Ready**: For single-user scenarios

---

## Key Concepts

### Queue Jobs
Background tasks that run asynchronously:
- Claim-based with optimistic locking
- Exponential backoff retries
- Deduplication to prevent duplicates
- 11 job types for full project lifecycle

**See**: CODEBASE_ARCHITECTURE.md section 4.2

### Presence System
Manages container lifecycle based on users:
- Viewers send heartbeats every 15 seconds
- Containers auto-start when someone views project
- Containers auto-stop after 3 minutes of inactivity
- Reaper runs every 30 seconds to cleanup

**See**: CODEBASE_ARCHITECTURE.md section 4.3

### Astro Actions
All server operations use this pattern:
- Input validation with Zod
- Auth check via context.locals.user
- DB operations via models
- Structured error responses

**See**: CODEBASE_ARCHITECTURE.md section 4.1

### Setup Phase
Tracks project initialization progress:
- Uses `initialPromptSent` and `initialPromptCompleted` booleans
- Exposed via PresenceResponse
- UI polls presence endpoint for updates

**See**: CODEBASE_ARCHITECTURE.md section 5 (Discrepancies)

---

## File Navigation Guide

### Core Application
```
src/middleware.ts              - Auth, setup check, queue startup
src/actions/index.ts           - All server actions (30+)
src/server/db/schema.ts        - Database schema
src/server/logger.ts           - Logging setup
```

### Queue System
```
src/server/queue/queue.worker.ts       - Main job loop
src/server/queue/queue.model.ts        - DB operations
src/server/queue/enqueue.ts            - Job enqueuers
src/server/queue/types.ts              - Job types
src/server/queue/handlers/             - 11 job handlers
```

### Presence & Lifecycle
```
src/server/presence/manager.ts         - Container lifecycle
src/server/projects/health.ts          - Health checks
```

### Pages & Components
```
src/pages/index.astro                  - Dashboard
src/pages/projects/[...params].astro   - Project page
src/pages/setup.astro                  - Admin setup
src/pages/queue.astro                  - Queue admin
src/pages/api/projects/[id]/opencode/[...path].ts  - Proxy
src/pages/api/projects/[id]/presence.ts            - Heartbeat
src/pages/api/projects/[id]/logs.ts                - Logs
src/components/chat/ChatPanel.tsx      - Chat UI
src/components/preview/PreviewPanel.tsx - Preview
src/components/setup/SetupStatusDisplay.tsx - Setup progress
src/components/terminal/TerminalDock.tsx - Logs display
```

### Configuration
```
astro.config.ts                - Framework config
drizzle.config.ts              - Database migrations
tsconfig.json                  - TypeScript config
components.json                - shadcn config
```

---

## Common Questions

**Q: Where do I add a new feature?**
A: Check ARCHITECTURE_QUICK_REFERENCE.md for your feature type (page, action, queue job, etc.)

**Q: How does authentication work?**
A: DB-backed sessions, bcrypt hashing, token validation in middleware. See CODEBASE_ARCHITECTURE.md section 4.5

**Q: How do long-running operations work?**
A: Via the queue system with rescheduling for polling. See CODEBASE_ARCHITECTURE.md section 4.2

**Q: How does the preview work?**
A: Iframe pointing to localhost:{devPort}, started via presence system. See CODEBASE_ARCHITECTURE.md section 4.3

**Q: What's the difference between what's documented and what's built?**
A: Minor differences in setup phase tracking. See IMPLEMENTATION_STATUS.md

**Q: Is this production-ready?**
A: Yes, for single-user scenarios. See IMPLEMENTATION_STATUS.md section 7

---

## Next Steps

1. **Understand the Codebase**: Read CODEBASE_ARCHITECTURE.md (30 min)
2. **Learn Quick Patterns**: Skim ARCHITECTURE_QUICK_REFERENCE.md (10 min)
3. **Know What's Missing**: Check IMPLEMENTATION_STATUS.md (10 min)
4. **Explore the Code**: Start with src/middleware.ts, then src/actions/index.ts
5. **Follow the Patterns**: Use existing code as templates for new features

---

## Document Maintenance

These documents were generated on December 20, 2025 via automated exploration of the codebase.

**When to update**:
- Adding major features (update IMPLEMENTATION_STATUS.md)
- Changing architecture patterns (update CODEBASE_ARCHITECTURE.md)
- Adding new constants/timeouts (update ARCHITECTURE_QUICK_REFERENCE.md)
- Changing tech stack (update all documents)

**How to update**:
- Keep docs in sync with AGENTS.md
- Use actual code as source of truth
- Include examples from real code
- Maintain consistent formatting

