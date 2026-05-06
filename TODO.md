# TODO

## AI planning prompts

Each paragraph is a different prompt to throw at the AI.

I want to make this app multi-user. Explore login, actions, projects, settings. Think about types of users, and permissions. Let's make it as simple as possible at first, i.e. admin vs regular user. Admins could have access to everything and users won't have access to stuff like tailscale config, providers, etc. Let's plan first.

I want to think about action-level rate limiting. Let's plan.

## Repository improvement plan

This plan captures practical improvements for doce.dev, ordered roughly by impact. The focus is production hardening, maintainability, and making future multi-user work easier.

### Priority 1: Verification and release safety

#### Add standard verification scripts

The project has `vitest` installed and a few test files, but `package.json` does not currently expose standard `test`, `typecheck`, or `check` scripts.

Recommended scripts:

- `typecheck`: run Astro/TypeScript checks.
- `test`: run Vitest once.
- `check`: run formatting/linting, typecheck, tests, and build.

Suggested shape:

```json
{
	"scripts": {
		"typecheck": "astro check",
		"test": "vitest run",
		"check": "pnpm format && pnpm typecheck && pnpm test && pnpm build"
	}
}
```

#### Gate Docker publishing on verification

The Docker workflow builds and publishes images from `main`, but should explicitly run the repo verification first. Add a CI job that runs `pnpm install --frozen-lockfile` and `pnpm check`, then make the Docker publish job depend on it.

### Priority 2: Runtime lifecycle hardening

#### Move startup side effects out of middleware

`src/middleware.ts` currently initializes the database, queue worker, Docker network/volume, OpenCode runtime, image prewarm, defaults bootstrap, and Tailscale startup during request handling.

This works, but middleware is a fragile place for long-running service lifecycle. It also makes the first request pay startup cost and couples routing/setup checks to infrastructure bootstrapping.

Recommended direction:

- Create a dedicated server bootstrap module for runtime initialization.
- Keep middleware focused on security headers, setup redirects, and auth.
- Make startup idempotent and observable with explicit status/error reporting.

#### Add a system status dashboard

The app already has queue, OpenCode, Docker, Tailscale, production, and health concepts. Add a single status page that shows:

- OpenCode runtime status.
- Docker availability.
- Queue depth and failed jobs.
- Tailscale status.
- Disk usage under `data/`.
- Recent failed jobs and recovery actions.

### Priority 3: Auth, authorization, and rate limiting

#### Centralize auth helpers

API routes and actions correctly authenticate themselves, but many action handlers repeat `context.locals.user` checks and project ownership checks.

Add small shared helpers such as:

- `requireActionUser(context)`
- `requireApiUser(cookies)`
- `requireProjectOwner(projectId, userId)`
- `requireAdmin(user)` once roles exist

This reduces drift and makes future multi-user/admin permissions easier to implement safely.

#### Add action-level rate limiting

Add rate limiting for expensive or abuse-prone operations. Start with a SQLite-backed per-user/per-action sliding window or token bucket.

Initial actions to protect:

- Project creation.
- Deploy/redeploy.
- Restart OpenCode.
- Tailscale connect/reconcile.
- Provider OAuth start/finish.
- Queue administrative actions.

#### Prepare for multi-user support

The schema already has users and project ownership, but still assumes a single admin user in comments and some product flows.

Recommended first step:

- Add `users.role` with `admin | user`.
- Add a unique username index.
- Define an authorization matrix for:
	- instance settings
	- provider settings
	- Tailscale settings
	- queue admin controls
	- project CRUD
	- production deployment
- Keep the first implementation simple: admins can manage everything, regular users can manage only their own projects.

### Priority 4: API and data-boundary hardening

#### Harden file browsing APIs

The project file API recursively walks `src/` and returns the full tree. Generated apps can become large, so this endpoint should have limits.

Recommended changes:

- Add max depth and max entry count.
- Ignore heavy folders such as `node_modules`, `dist`, `.astro`, `coverage`, and build outputs.
- Consider lazy loading per directory instead of returning the whole tree.
- Do not return internal absolute paths in invalid-path errors.
- Add tests for path traversal, ignored folders, and large-tree limits.

#### Normalize JSON response helpers

Many API routes manually construct JSON `Response` objects. Add tiny helpers for consistency:

- `json(data, status?)`
- `jsonError(message, status)`
- `unauthorized()`
- `notFound()`

This keeps status codes, headers, and error payloads consistent.

#### Validate API inputs with Zod

Actions already use Zod schemas. Mirror that pattern in API routes for:

- route params
- query params
- request bodies
- SSE offsets/cursors
- project IDs
- queue job IDs

### Priority 5: Maintainability and code organization

#### Split large modules by responsibility

Several files are large enough that changes are riskier than necessary:

- `src/actions/projects.ts`
- `src/server/docker/compose.ts`
- `src/hooks/useChatPanel.ts`
- `src/components/preview/PreviewPanel.tsx`
- `src/server/db/schema.ts`

Use the queue model split as a pattern. Possible splits:

- `projects.create.action.ts`
- `projects.lifecycle.action.ts`
- `projects.production.action.ts`
- `projects.identity.action.ts`
- `compose.network.ts`
- `compose.lifecycle.ts`
- `compose.logs.ts`
- `useChatHistory.ts`
- `useChatStreaming.ts`
- `usePreviewLiveState.ts`

Keep public exports backward compatible while migrating.

#### Clean up deprecated state fields

`projects.status` is marked deprecated in favor of desired/observed status. Track a migration plan to remove old state once compatibility is no longer needed.

Suggested steps:

1. Audit all reads/writes of `status`.
2. Replace user-facing state with derived desired/observed state.
3. Add a migration to remove the deprecated column when safe.

### Priority 6: Security and ops hardening

#### Improve Docker image supply-chain posture

The Dockerfile pins several tool versions, which is good, but it downloads binaries/scripts over the network during build.

Recommended changes:

- Verify checksums for downloaded binaries where possible.
- Prefer Corepack for pnpm instead of `npm install -g pnpm`.
- Keep OpenCode, Tailscale, and Docker Compose versions centralized.
- Document the update process for pinned runtime tools.

#### Add Content-Security-Policy carefully

Middleware already sets several security headers. Add a conservative CSP once tested with Monaco, previews, iframes, SSE, and any remote images.

Start with report-only mode, then tighten.

#### Document the Docker socket security model

The deployment mounts `/var/run/docker.sock`, which effectively grants host-level control to the app. The README should have a clear security model section covering:

- Run only for trusted users.
- Prefer isolating doce.dev inside a VM.
- Do not expose publicly without auth, TLS, and rate limits.
- Generated projects and agents should be treated as privileged workloads.

#### Restrict comment-triggered GitHub automation

The OpenCode GitHub workflow runs on a self-hosted runner when comments contain `/oc` or `/opencode`. Add a permission check so only trusted collaborators can trigger it, similar to the PR preview approval gate.

### Priority 7: Product and UX improvements

#### Add guided recovery actions

The app already has diagnostics and queue/runtime status concepts. Add user-facing recovery flows for common failure modes:

- Restart preview.
- Restart OpenCode.
- Clear stuck queue lock.
- Rebuild production container.
- Open latest logs.
- Retry failed job.

#### Improve contributor documentation

The README is strong for deployment, but should add a development section:

- Local setup.
- Required Docker permissions.
- Database migrations.
- Preview architecture.
- How to run format/typecheck/tests/build.
- Common debugging commands.

### Suggested next five tasks

1. Add `test`, `typecheck`, and `check` scripts, then wire them into CI.
2. Add action-level rate limiting for project creation, deploy, restart, and provider flows.
3. Split `src/actions/projects.ts` into focused action modules.
4. Add reusable auth/authorization helpers for actions and API routes.
5. Harden the file tree/content API with limits, ignores, safer errors, and tests.
