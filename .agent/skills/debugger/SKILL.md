---
name: debugger
description: Debug this app using Chrome DevTools MCP tools and server-side log analysis.
---

## Required MCPs

- `chrome-devtools` - Browser automation, debugging, screenshots, network analysis
- `skill_mcp` (with `playwright` skill) - Alternative browser automation for complex flows

## Debug Behavior

1. **Start dev server**: Run `pnpm dev` in background, pipe logs to `/tmp/dev-server.log`
2. **Navigate**: Open the page, take snapshot to understand current state
3. **Inspect**: Check console errors, network requests, and page structure
4. **Interact**: Click, fill forms, trigger actions to reproduce issues
5. **Verify**: Confirm fix by re-testing the scenario

Always check both browser console AND server logs when debugging.

## Happy Path (Default Test Flow)

When no specific test is requested:

1. **Auth** - Signup/login with `admin/admin`
2. **Setup API Key** - Set OpenRouter key (from `$OPENROUTER_API_KEY` or ask user)
3. **Create Project** - "Minimal digital clock. Big, on the center. HH:MM"
4. **Verify Preview** - Check website loads in preview panel
5. **Request Change** - "Change clock to be red" and verify update
