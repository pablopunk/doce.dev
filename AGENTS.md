# AI Agent Guide for V0 Builder

This document provides comprehensive guidance for AI agents working with this self-hosted v0.dev clone project.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Database Schema](#database-schema)
5. [File Structure](#file-structure)
6. [Core Systems](#core-systems)
7. [API Endpoints](#api-endpoints)
8. [Common Tasks](#common-tasks)
9. [Code Patterns](#code-patterns)
10. [Troubleshooting](#troubleshooting)

---

## Project Overview

**V0 Builder** is a self-hosted AI website builder that allows users to:
- Chat with an AI to generate websites
- Preview generated code in real-time
- Deploy websites to unique URLs within their homelab
- Manage multiple projects simultaneously

**Key Features:**
- AI-powered code generation (OpenAI/Anthropic)
- Automatic preview environments using Docker
- One-click deployments with persistent URLs
- Setup wizard for initial configuration
- SQLite database for simplicity
- Traefik for dynamic routing

---

## Architecture

### System Components

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                         Traefik                              │
│              (Reverse Proxy & Router)                        │
│  Routes: /, /preview/{id}, /site/{deployment-id}            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Main Application                          │
│                    (Next.js 16)                              │
│  - Chat Interface                                            │
│  - Project Management                                        │
│  - Docker Orchestration                                      │
│  - Setup Wizard                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Preview         │  │  Deployment      │
        │  Containers      │  │  Containers      │
        │  (Temporary)     │  │  (Persistent)    │
        └──────────────────┘  └──────────────────┘
\`\`\`

### Data Flow

1. **User Prompt** → AI generates code
2. **Code Extraction** → Parse markdown code blocks with file paths
3. **Storage** → Save to SQLite database + filesystem
4. **Preview** → Build Docker image → Start container → Traefik routes `/preview/{id}`
5. **Deploy** → Build Docker image → Start persistent container → Traefik routes `/site/{deployment-id}`

---

## Technology Stack

### Core Technologies

- **Next.js 16**: App Router, Server Actions, React 19
- **TypeScript**: Type safety throughout
- **Tailwind CSS v4**: Styling with design tokens
- **shadcn/ui**: Component library
- **pnpm**: Package manager

### Infrastructure

- **Docker**: Container orchestration
- **Traefik**: Reverse proxy with automatic service discovery
- **SQLite**: Database (via better-sqlite3)
- **Dockerode**: Docker API client for Node.js

### AI Integration

- **Vercel AI SDK**: Unified AI interface
- **OpenAI**: GPT-4o (default if no Anthropic key)
- **Anthropic**: Claude 3.5 Sonnet (preferred if key provided)

### Why These Choices?

- **Traefik**: Automatically discovers Docker containers via labels, no manual nginx config
- **SQLite**: Simple, file-based, no separate database server needed
- **pnpm**: Faster, more efficient than npm
- **Docker**: Isolated preview/deployment environments

---

## Database Schema

### Tables

#### `config`
Stores system configuration.

\`\`\`sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

**Key Records:**
- `setup_complete`: "true" when setup wizard is finished
- `ai_provider`: "openai" or "anthropic"
- `openai_api_key`: Encrypted API key
- `anthropic_api_key`: Encrypted API key

#### `users`
User accounts (currently single-user system).

\`\`\`sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

#### `projects`
Website projects.

\`\`\`sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  status TEXT DEFAULT 'draft',
  preview_url TEXT,
  deployed_url TEXT
);
\`\`\`

**Status Values:**
- `draft`: Initial state
- `building`: Preview/deployment in progress
- `ready`: Preview available
- `deployed`: Has active deployment
- `error`: Build/deployment failed

#### `conversations`
Chat conversations per project.

\`\`\`sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
\`\`\`

#### `messages`
Individual chat messages.

\`\`\`sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
\`\`\`

**Role Values:**
- `user`: User message
- `assistant`: AI response

#### `files`
Generated code files.

\`\`\`sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, file_path)
);
\`\`\`

#### `deployments`
Deployment records.

\`\`\`sql
CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  container_id TEXT,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'building',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
\`\`\`

**Status Values:**
- `building`: Container being created
- `running`: Successfully deployed
- `stopped`: Container stopped
- `error`: Deployment failed

---

## File Structure

\`\`\`
/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── admin/
│   │   │   └── cleanup/          # Container cleanup endpoint
│   │   ├── chat/
│   │   │   └── [projectId]/      # AI chat streaming
│   │   ├── deployments/
│   │   │   └── [id]/             # Deployment management
│   │   ├── projects/
│   │   │   ├── [id]/
│   │   │   │   ├── build/        # Build preview
│   │   │   │   ├── deploy/       # Create deployment
│   │   │   │   ├── files/        # File management
│   │   │   │   ├── generate/     # Code generation
│   │   │   │   ├── preview/      # Preview management
│   │   │   │   └── route.ts      # Project CRUD
│   │   │   └── route.ts          # List/create projects
│   │   ├── setup/                # Setup wizard endpoints
│   │   │   ├── ai/               # AI provider config
│   │   │   ├── complete/         # Mark setup complete
│   │   │   ├── status/           # Check setup status
│   │   │   └── user/             # Create admin user
│   │   └── stats/                # System statistics
│   ├── dashboard/                # Project dashboard page
│   ├── project/[id]/             # Project detail page
│   ├── setup/                    # Setup wizard page
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home/landing page
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   ├── chat-interface.tsx        # Chat UI
│   ├── code-preview.tsx          # Code preview panel
│   ├── create-project-button.tsx # New project button
│   ├── deployment-list.tsx       # Deployment list
│   ├── project-list.tsx          # Project cards
│   └── system-stats.tsx          # System stats widget
├── lib/                          # Utility libraries
│   ├── cleanup.ts                # Container cleanup logic
│   ├── code-generator.tsx        # Code extraction/generation
│   ├── db.ts                     # Database functions
│   ├── docker.ts                 # Docker orchestration
│   ├── file-system.ts            # File operations
│   ├── template-generator.tsx    # Project templates
│   └── utils.ts                  # General utilities
├── hooks/                        # React hooks
│   ├── use-mobile.ts             # Mobile detection
│   └── use-toast.ts              # Toast notifications
├── public/                       # Static assets
├── data/                         # SQLite database (created at runtime)
├── projects/                     # Generated project files (created at runtime)
├── docker-compose.yml            # Docker Compose config
├── Dockerfile                    # Main app Dockerfile
├── middleware.ts                 # Next.js middleware (setup redirect)
├── next.config.mjs               # Next.js config
├── package.json                  # Dependencies
├── pnpm-lock.yaml                # Lock file
└── tsconfig.json                 # TypeScript config
\`\`\`

---

## Core Systems

### 1. Setup Wizard

**Purpose:** First-run configuration for admin user and AI provider.

**Flow:**
1. User visits app for first time
2. Middleware checks `setup_complete` in config table
3. If not complete, redirect to `/setup`
4. Setup wizard collects:
   - Admin username/password
   - AI provider (OpenAI or Anthropic)
   - API key
5. On completion, sets `setup_complete = "true"`
6. Redirects to dashboard

**Files:**
- `app/setup/page.tsx`: Setup wizard UI
- `app/api/setup/*/route.ts`: Setup endpoints
- `middleware.ts`: Setup check and redirect

**Important:** Setup wizard only runs once. To reset, delete the SQLite database.

### 2. AI Chat System

**Purpose:** Generate code from natural language prompts.

**Flow:**
1. User types prompt in chat interface
2. POST to `/api/chat/[projectId]`
3. AI SDK streams response using OpenAI or Anthropic
4. Response saved to `messages` table
5. Code blocks extracted from response
6. Files saved to database and filesystem

**Code Extraction:**
The AI is instructed to format code as:

\`\`\`tsx file="app/page.tsx"
export default function Page() {
  return <div>Hello</div>
}
\`\`\`

The `extractCodeBlocks()` function in `lib/code-generator.tsx` parses these blocks using regex:
- Matches: ` \`\`\`language file="path" `
- Extracts file path and content
- Saves to database and filesystem

**Files:**
- `components/chat-interface.tsx`: Chat UI with message list
- `app/api/chat/[projectId]/route.ts`: Streaming AI endpoint
- `lib/code-generator.tsx`: Code extraction logic

**AI System Prompt:**
Located in `app/api/chat/[projectId]/route.ts`, instructs AI to:
- Use Next.js 16 with App Router
- Use Tailwind CSS v4
- Generate TypeScript code
- Format code with file paths
- Create complete, working code

### 3. Preview System

**Purpose:** Create temporary Docker containers to preview generated code.

**Flow:**
1. User clicks "Preview" button
2. POST to `/api/projects/[id]/preview`
3. System calls `createPreviewContainer()` from `lib/docker.ts`
4. Dockerfile generated dynamically
5. Docker image built from project files
6. Container started with Traefik labels
7. Traefik routes `/preview/{projectId}` to container
8. Preview URL returned to frontend

**Container Configuration:**
\`\`\`typescript
Labels: {
  "traefik.enable": "true",
  "traefik.http.routers.{subdomain}.rule": "PathPrefix(`/preview/{projectId}`)",
  "traefik.http.middlewares.{subdomain}-strip.stripprefix.prefixes": "/preview/{projectId}",
  "v0.project.id": projectId,
  "v0.container.type": "preview"
}
\`\`\`

**Cleanup:**
- Preview containers are temporary
- Automatically cleaned up after 24 hours
- Manual cleanup via `/api/admin/cleanup`
- Stopped and removed when new preview created

**Files:**
- `lib/docker.ts`: Docker orchestration
- `app/api/projects/[id]/preview/route.ts`: Preview endpoint
- `components/code-preview.tsx`: Preview UI with iframe

### 4. Deployment System

**Purpose:** Create persistent Docker containers for published websites.

**Flow:**
1. User clicks "Publish" button
2. POST to `/api/projects/[id]/deploy`
3. System calls `createDeploymentContainer()` from `lib/docker.ts`
4. Unique deployment ID generated (nanoid)
5. Docker image built from project files
6. Container started with restart policy
7. Traefik routes `/site/{deploymentId}` to container
8. Deployment record saved to database

**Container Configuration:**
\`\`\`typescript
Labels: {
  "traefik.enable": "true",
  "traefik.http.routers.{subdomain}.rule": "PathPrefix(`/site/{deploymentId}`)",
  "v0.deployment.id": deploymentId,
  "v0.container.type": "deployment"
},
RestartPolicy: {
  Name: "unless-stopped"
}
\`\`\`

**Deployment Management:**
- Multiple deployments per project supported
- Each deployment gets unique URL
- Deployments persist across system restarts
- Can be stopped/started/deleted individually

**Files:**
- `lib/docker.ts`: Docker orchestration
- `app/api/projects/[id]/deploy/route.ts`: Deploy endpoint
- `app/api/deployments/[id]/route.ts`: Deployment management
- `components/deployment-list.tsx`: Deployment list UI

### 5. File System

**Purpose:** Store generated code files for building Docker images.

**Structure:**
\`\`\`
/app/projects/
  ├── {project-id-1}/
  │   ├── package.json
  │   ├── next.config.mjs
  │   ├── tsconfig.json
  │   ├── app/
  │   │   ├── layout.tsx
  │   │   ├── page.tsx
  │   │   └── globals.css
  │   └── components/
  └── {project-id-2}/
      └── ...
\`\`\`

**Operations:**
- `writeProjectFiles()`: Write files from database to filesystem
- `generateDefaultProjectStructure()`: Create base Next.js structure
- Files stored in both database (for history) and filesystem (for building)

**Files:**
- `lib/file-system.ts`: File operations
- `lib/template-generator.tsx`: Project templates

---

## API Endpoints

### Setup Endpoints

#### `POST /api/setup/user`
Create admin user account.

**Request:**
\`\`\`json
{
  "username": "admin",
  "password": "secure-password"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "userId": "uuid"
}
\`\`\`

#### `POST /api/setup/ai`
Configure AI provider.

**Request:**
\`\`\`json
{
  "provider": "openai",
  "apiKey": "sk-..."
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true
}
\`\`\`

#### `POST /api/setup/complete`
Mark setup as complete.

**Response:**
\`\`\`json
{
  "success": true
}
\`\`\`

#### `GET /api/setup/status`
Check if setup is complete.

**Response:**
\`\`\`json
{
  "setupComplete": true
}
\`\`\`

### Project Endpoints

#### `GET /api/projects`
List all projects.

**Response:**
\`\`\`json
{
  "projects": [
    {
      "id": "uuid",
      "name": "My Website",
      "description": "A cool website",
      "status": "ready",
      "preview_url": "/preview/uuid",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
\`\`\`

#### `POST /api/projects`
Create new project.

**Request:**
\`\`\`json
{
  "name": "My Website",
  "description": "Optional description"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "uuid",
  "name": "My Website",
  "description": "Optional description"
}
\`\`\`

#### `GET /api/projects/[id]`
Get project details.

**Response:**
\`\`\`json
{
  "id": "uuid",
  "name": "My Website",
  "status": "ready",
  "preview_url": "/preview/uuid",
  "files": [
    {
      "file_path": "app/page.tsx",
      "content": "export default...",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
\`\`\`

#### `DELETE /api/projects/[id]`
Delete project and associated containers.

**Response:**
\`\`\`json
{
  "success": true
}
\`\`\`

#### `GET /api/projects/[id]/files`
Get all files for a project.

**Response:**
\`\`\`json
{
  "files": [
    {
      "id": "uuid",
      "file_path": "app/page.tsx",
      "content": "...",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
\`\`\`

#### `POST /api/projects/[id]/preview`
Create or update preview container.

**Response:**
\`\`\`json
{
  "success": true,
  "url": "/preview/uuid",
  "containerId": "docker-container-id"
}
\`\`\`

#### `POST /api/projects/[id]/deploy`
Create deployment.

**Response:**
\`\`\`json
{
  "success": true,
  "deployment": {
    "id": "deployment-id",
    "url": "/site/deployment-id",
    "status": "building"
  }
}
\`\`\`

### Chat Endpoints

#### `POST /api/chat/[projectId]`
Stream AI chat response.

**Request:**
\`\`\`json
{
  "messages": [
    {
      "role": "user",
      "content": "Create a landing page"
    }
  ]
}
\`\`\`

**Response:**
Streaming response using AI SDK's `toUIMessageStreamResponse()`.

### Deployment Endpoints

#### `GET /api/deployments/[id]`
Get deployment status.

**Response:**
\`\`\`json
{
  "id": "deployment-id",
  "project_id": "uuid",
  "url": "/site/deployment-id",
  "status": "running",
  "created_at": "2025-01-01T00:00:00Z"
}
\`\`\`

#### `DELETE /api/deployments/[id]`
Stop and remove deployment.

**Response:**
\`\`\`json
{
  "success": true
}
\`\`\`

### Admin Endpoints

#### `POST /api/admin/cleanup`
Clean up old preview containers.

**Response:**
\`\`\`json
{
  "success": true,
  "cleaned": 5
}
\`\`\`

#### `GET /api/stats`
Get system statistics.

**Response:**
\`\`\`json
{
  "totalProjects": 10,
  "totalDeployments": 5,
  "activeContainers": 3,
  "diskUsage": "1.2 GB"
}
\`\`\`

---

## Common Tasks

### Adding a New Feature

1. **Plan the feature:**
   - Identify which systems are affected
   - Check if database schema changes needed
   - Determine API endpoints required

2. **Update database schema:**
   - Modify `lib/db.ts` to add new tables/columns
   - Add migration logic if needed
   - Update TypeScript types

3. **Create API endpoints:**
   - Add route in `app/api/`
   - Implement business logic
   - Add error handling

4. **Build UI components:**
   - Create component in `components/`
   - Use shadcn/ui components
   - Follow Tailwind CSS patterns

5. **Test the feature:**
   - Test API endpoints
   - Test UI interactions
   - Test Docker integration if applicable

### Modifying the AI System Prompt

**Location:** `app/api/chat/[projectId]/route.ts`

**Current prompt:**
\`\`\`typescript
system: `You are an expert web developer and designer...`
\`\`\`

**To modify:**
1. Read the current prompt
2. Update the system message
3. Test with various prompts
4. Ensure code extraction still works

**Important:** The prompt must instruct the AI to use the file path syntax:
\`\`\`
\`\`\`tsx file="path/to/file.tsx"
\`\`\`

### Adding a New AI Provider

1. **Install SDK:**
\`\`\`bash
pnpm add @ai-sdk/provider-name
\`\`\`

2. **Update chat route:**
\`\`\`typescript
import { providerName } from "@ai-sdk/provider-name"

const model = process.env.PROVIDER_API_KEY
  ? providerName("model-name")
  : openai("gpt-4o")
\`\`\`

3. **Update setup wizard:**
- Add provider option in `app/setup/page.tsx`
- Add API key field
- Update `app/api/setup/ai/route.ts`

4. **Update environment variables:**
- Add to `.env.example`
- Document in README.md

### Debugging Container Issues

**Check container logs:**
\`\`\`bash
docker logs v0-preview-{projectId}
docker logs v0-deploy-{deploymentId}
\`\`\`

**List all v0 containers:**
\`\`\`bash
docker ps -a --filter "label=v0.project.id"
\`\`\`

**Inspect Traefik routing:**
\`\`\`bash
docker logs traefik
\`\`\`

**Check container labels:**
\`\`\`bash
docker inspect v0-preview-{projectId} | jq '.[0].Config.Labels'
\`\`\`

**Manual cleanup:**
\`\`\`bash
docker stop $(docker ps -q --filter "label=v0.container.type=preview")
docker rm $(docker ps -aq --filter "label=v0.container.type=preview")
\`\`\`

### Modifying Project Templates

**Location:** `lib/template-generator.tsx`

**Current templates:**
- Landing page
- Blog
- Portfolio
- Dashboard

**To add new template:**
1. Add template function
2. Return array of `GeneratedFile[]`
3. Include all necessary files (package.json, config, pages)
4. Update template selector UI

### Customizing Traefik Configuration

**Location:** `docker-compose.yml`

**Current configuration:**
- HTTP only (port 80)
- Docker provider enabled
- Dashboard accessible at port 8080

**To enable HTTPS:**
1. Add Let's Encrypt configuration
2. Add certificate resolver
3. Update container labels to use HTTPS entrypoint
4. Configure domain names

**To enable custom domains instead of path-based routing:**
```typescript
// In lib/docker.ts, change from:
[`traefik.http.routers.${subdomain}.rule`]: `PathPrefix(\`/site/${deploymentId}\`)`

// To:
[`traefik.http.routers.${subdomain}.rule`]: `Host(\`${deploymentId}.yourdomain.com\`)`
```

**Resource limits for deployment containers:**
```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 512M
```

---

## Code Patterns

### Database Operations

**Always use prepared statements:**
\`\`\`typescript
// ✅ Good
db.prepare("SELECT * FROM projects WHERE id = ?").get(id)

// ❌ Bad
db.exec(`SELECT * FROM projects WHERE id = '${id}'`)
\`\`\`

**Use transactions for multiple operations:**
\`\`\`typescript
const transaction = db.transaction(() => {
  db.prepare("INSERT INTO projects ...").run(...)
  db.prepare("INSERT INTO conversations ...").run(...)
})

transaction()
\`\`\`

### Docker Operations

**Always handle errors:**
\`\`\`typescript
try {
  const container = await docker.getContainer(id)
  await container.stop()
} catch (error) {
  console.error("Failed to stop container:", error)
  // Don't throw - container might already be stopped
}
\`\`\`

**Clean up resources:**
\`\`\`typescript
// Always remove containers when done
await container.stop()
await container.remove({ force: true })
\`\`\`

**Wait for containers to be ready:**
\`\`\`typescript
await waitForContainer(containerId, 30000)
\`\`\`

### React Components

**Use client components for interactivity:**
\`\`\`typescript
"use client"

export function ChatInterface() {
  const [messages, setMessages] = useState([])
  // ...
}
\`\`\`

**Use server components for data fetching:**
\`\`\`typescript
export default async function ProjectPage({ params }) {
  const project = await getProject(params.id)
  return <div>{project.name}</div>
}
\`\`\`

**Use shadcn/ui components:**
\`\`\`typescript
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
\`\`\`

### API Routes

**Handle async params in Next.js 16:**
\`\`\`typescript
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // ...
}
\`\`\`

**Return proper responses:**
\`\`\`typescript
// Success
return Response.json({ success: true, data })

// Error
return Response.json(
  { error: "Message" },
  { status: 400 }
)
\`\`\`

**Use streaming for AI responses:**
\`\`\`typescript
const result = streamText({ model, messages })
return result.toUIMessageStreamResponse()
\`\`\`

### Error Handling

**API routes:**
\`\`\`typescript
try {
  // Operation
  return Response.json({ success: true })
} catch (error) {
  console.error("Operation failed:", error)
  return Response.json(
    { error: "Operation failed" },
    { status: 500 }
  )
}
\`\`\`

**Docker operations:**
\`\`\`typescript
try {
  await createPreviewContainer(projectId)
} catch (error) {
  console.error("Failed to create preview:", error)
  await updateProject(projectId, { status: "error" })
  throw error
}
\`\`\`

---

## Troubleshooting

### Setup Wizard Issues

**Problem:** Setup wizard keeps redirecting even after completion.

**Solution:**
1. Check database: `sqlite3 data/v0builder.db "SELECT * FROM config WHERE key='setup_complete'"`
2. Should return `true`
3. If not, manually set: `sqlite3 data/v0builder.db "INSERT OR REPLACE INTO config (key, value) VALUES ('setup_complete', 'true')"`

**Problem:** API key not working.

**Solution:**
1. Check environment variables are set
2. Restart Docker containers: `docker-compose restart`
3. Check logs: `docker-compose logs app`

### Preview/Deployment Issues

**Problem:** Preview container fails to build.

**Solution:**
1. Check project files exist: `ls -la projects/{projectId}/`
2. Check Dockerfile was generated
3. Check Docker logs: `docker logs v0-preview-{projectId}`
4. Common issues:
   - Missing package.json
   - Invalid TypeScript syntax
   - Missing dependencies

**Problem:** Preview URL returns 404.

**Solution:**
1. Check container is running: `docker ps | grep v0-preview`
2. Check Traefik routing: `docker logs traefik | grep preview`
3. Check container labels: `docker inspect v0-preview-{projectId}`
4. Verify Traefik can reach container network

**Problem:** Deployment stuck in "building" status.

**Solution:**
1. Check container status: `docker ps -a | grep v0-deploy`
2. Check container logs: `docker logs v0-deploy-{deploymentId}`
3. Manually update status: `sqlite3 data/v0builder.db "UPDATE deployments SET status='error' WHERE id='{id}'"`

### Database Issues

**Problem:** Database locked error.

**Solution:**
1. SQLite doesn't handle concurrent writes well
2. Ensure only one process accesses database
3. Add retry logic with exponential backoff
4. Consider connection pooling

**Problem:** Database corruption.

**Solution:**
1. Stop all containers: `docker-compose down`
2. Backup database: `cp data/v0builder.db data/v0builder.db.backup`
3. Try recovery: `sqlite3 data/v0builder.db ".recover" | sqlite3 data/v0builder_recovered.db`
4. If recovery fails, restore from backup

### Docker Issues

**Problem:** "Cannot connect to Docker daemon."

**Solution:**
1. Check Docker is running: `docker ps`
2. Check socket permissions: `ls -la /var/run/docker.sock`
3. Ensure app container has socket access (volume mount in docker-compose.yml)

**Problem:** Port already in use.

**Solution:**
1. Check what's using port: `lsof -i :80`
2. Stop conflicting service
3. Or change port in docker-compose.yml

**Problem:** Out of disk space.

**Solution:**
1. Clean up old images: `docker image prune -a`
2. Clean up old containers: `docker container prune`
3. Clean up volumes: `docker volume prune`
4. Implement automatic cleanup in `lib/cleanup.ts`

### AI Generation Issues

**Problem:** AI not generating code with file paths.

**Solution:**
1. Check system prompt in `app/api/chat/[projectId]/route.ts`
2. Ensure prompt includes file path instructions
3. Test with explicit prompt: "Create app/page.tsx with..."

**Problem:** Code extraction failing.

**Solution:**
1. Check regex in `lib/code-generator.tsx`
2. Log AI response to see format
3. Update regex to match AI's output format

**Problem:** Generated code has errors.

**Solution:**
1. Improve system prompt with more specific instructions
2. Add validation before saving files
3. Implement linting/type checking
4. Provide better context in user prompts

---

## Best Practices

### Security

1. **Never expose Docker socket directly to internet**
2. **Validate all user inputs**
3. **Use environment variables for secrets**
4. **Implement rate limiting on AI endpoints**
5. **Add authentication/authorization** (currently single-user)
6. **Sanitize file paths** to prevent directory traversal
7. **Limit container resources** (CPU, memory)

### Performance

1. **Use SQLite WAL mode** for better concurrency
2. **Implement caching** for frequently accessed data
3. **Clean up old containers** regularly
4. **Limit number of concurrent builds**
5. **Use Docker layer caching** for faster builds
6. **Implement pagination** for large lists

### Reliability

1. **Add health checks** to containers
2. **Implement retry logic** for Docker operations
3. **Add logging** throughout the application
4. **Monitor disk usage** and alert when low
5. **Backup database** regularly
6. **Test failure scenarios** (network issues, out of memory, etc.)

### Code Quality

1. **Use TypeScript** for type safety
2. **Follow consistent naming conventions**
3. **Write descriptive comments** for complex logic
4. **Keep functions small and focused**
5. **Use async/await** instead of callbacks
6. **Handle errors gracefully**
7. **Write tests** for critical functionality

---

## Future Enhancements

### Planned Features

1. **Multi-user support** with authentication
2. **Project sharing** and collaboration
3. **Custom domains** for deployments
4. **HTTPS/SSL** support
5. **Git integration** for version control
6. **Template marketplace**
7. **Resource monitoring** and alerts
8. **Backup/restore** functionality
9. **API rate limiting**
10. **Webhook support** for CI/CD

### Potential Improvements

1. **Replace SQLite with PostgreSQL** for better concurrency
2. **Add Redis** for caching and job queues
3. **Implement WebSockets** for real-time updates
4. **Add code editor** with syntax highlighting
5. **Implement file tree view**
6. **Add project export/import**
7. **Support for other frameworks** (Vue, Svelte, etc.)
8. **Container orchestration** with Kubernetes
9. **Monitoring dashboard** with metrics
10. **Cost estimation** for resource usage

## Additional Deployment Notes

### Container Management

**Preview containers:**
- Auto-cleanup after 24 hours
- Temporary, meant for testing
- Removed when new preview created

**Deployment containers:**
- Persistent (restart unless-stopped)
- Multiple deployments per project allowed
- Manual cleanup required

### Local Development

For development without Docker:

1. Install dependencies:
```bash
pnpm install
```

2. Set environment variables in `.env.local`:
```env
DATABASE_PATH=./data/v0builder.db
OPENAI_API_KEY=sk-...
# or
ANTHROPIC_API_KEY=sk-ant-...
```

3. Run development server:
```bash
pnpm dev
```

**Note:** Preview/deployment features require Docker.

### Docker Commands

**View logs:**
```bash
docker-compose logs -f app
```

**Update application:**
```bash
docker-compose down
docker-compose pull
docker-compose up -d --build
```

**List all v0 containers:**
```bash
docker ps -a --filter "label=v0.project.id"
```

---

## Conclusion

This guide provides a comprehensive overview of the doce.dev (V0 Builder) project architecture, systems, and patterns. When working with this codebase:

1. **Always read existing code** before making changes
2. **Follow established patterns** for consistency
3. **Test Docker operations** thoroughly
4. **Handle errors gracefully**
5. **Document significant changes**
6. **Consider security implications**
7. **Think about scalability**

This document (AGENTS.md) contains all the technical information needed for AI agents and developers working with the codebase.

Happy coding! 🚀

