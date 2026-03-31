---
name: debugger
description: Debug this app using agent-browse
---

## Required Skills

- agent-browser

## Debug Behavior

1. **Start dev server**: Only if it's not running already Only if it's not running already.. Run `pnpm dev` in background, pipe logs to `/tmp/dev-server.log`
2. **Navigate**: Open the page, take snapshot to understand current state
3. **Inspect**: Check console errors, network requests, and page structure
4. **Interact**: Click, fill forms, trigger actions to reproduce issues
5. **Verify**: Confirm fix by re-testing the scenario

Always check both browser console AND server logs when debugging.

## Happy Path (Default Test Flow)

When no specific test is requested:

1. **Auth** - Signup/login with `admin/admin`
2. **Create Project** - "Minimal digital clock. Big, on the center. HH:MM". Use a fast but smart model, like haiku-4.5, if it is available. Or any of the default opencode already provides.
3. **Verify Preview** - Check website loads in preview panel
4. **Request Change** - "Change clock to be red" and verify update
5. **Delete Project** - Delete the project from the dashboard. Confirm it's gone after a few seconds and check the project's folder, docker container, and opencode session, to be gone for good.
