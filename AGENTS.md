# doce.dev agent guide

## Working rules

- Use `pnpm`; never use npm, Yarn, or Bun.
- Inspect nearby implementations and follow established conventions before editing.
- Use Biome through `pnpm format`; do not introduce ESLint or Prettier.
- Keep types precise and avoid `any`. If `any` is necessary, explain why in a code comment.
- Use `defineAction` with Zod `input` schemas for server actions.
- Prefer React hooks or programmatic Astro-action fetches over HTML forms for CRUD.
- Use `sonner` for action feedback instead of inline success, error, or info callouts.

## Server, auth, and data

- Use `@/server/logger` (Pino), not `console.*`, in server code.
- API routes must authenticate from cookies themselves; middleware authentication does not cover `/_actions` or `/api`.
- Prefer client-side fetching and hydration for large or potentially unbounded payloads.
- Use the existing Drizzle schema, migrations, and query patterns. Do not make destructive database changes for debugging.
- Keep debugging read-only unless a mutation is explicitly required. Run servers and other long-lived commands in the foreground with a bounded execution; clean them up and collect logs and exit status before finishing rather than detaching or backgrounding them.

## Server lifecycle changes

- Before moving initialization among middleware, Astro integrations, adapters, or entrypoints, inspect the installed Astro and adapter versions and their implementation or version-matched documentation.
- Distinguish dev-server hooks, build-time hooks, module import timing, and standalone process startup. Never assume an Astro hook that runs in development or during build also runs when `pnpm start` launches `dist/server/entry.mjs`.
- Preserve startup failure and retry behavior. Keep expensive subsystem orchestration outside request handling unless per-request execution is explicitly intended.
- For startup changes, verify both `pnpm dev` and a freshly built standalone path (`pnpm build`, then `pnpm start`). In each runtime, capture startup failure behavior and make at least one request after readiness. Static inspection, `pnpm check`, or testing only one path is not sufficient evidence.

## Verification

- Run targeted tests while developing.
- Before finishing, run `pnpm check`, which covers Biome, type checking, tests, and the production build.
- Report any check or runtime path that could not be exercised and why.
