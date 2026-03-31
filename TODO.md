# Before Release TODO

## Phase 1 - Foundation
- [x] Refactor settings page to tabs
  - [x] Providers tab
  - [x] MCPs tab
  - [x] Skills tab
  - [x] General tab
- [x] Add first-boot image prewarm for Astro template runtime
  - [x] Run on app startup checks (non-blocking)
  - [x] Pre-pull/pre-build what `templates/astro-starter/docker-compose.yml` needs
  - [x] Pre-pull/pre-build what `templates/astro-starter/docker-compose.production.yml` needs
  - [x] Surface status so users know warmup is in progress/completed
- [ ] Run integration operations through existing queue
  - [ ] Skills discovery sync
  - [ ] Skill install/remove/update
  - [ ] MCP status refresh/test
  - [ ] Global defaults sync to existing projects
- [x] Keep settings as normal UI with lightweight inline status
- [x] Link to /queue for full details and retries

## Phase 2 - skills.sh Core
- [x] Add backend skills service for skills.sh operations
  - [x] Discover/search
  - [x] Install
  - [x] Remove
  - [ ] Update
- [x] Build Skills tab UI
  - [x] Search/discovery list
  - [x] Installed skills list
  - [x] Install/remove/update actions
  - [ ] Global enable/disable state (all projects)
- [x] Show skill metadata before install
  - [x] owner/repo
  - [x] skill name
  - [x] install count

## Phase 3 - MCP Core
- [x] Add MCP settings management for default servers
  - [x] context7
  - [x] exa
  - [x] gh_grep
- [x] Implement OpenCode-native MCP actions in UI
  - [ ] Authenticate
  - [ ] Logout
  - [ ] Test connection
  - [x] Enable/Disable
- [ ] Apply initial MCP default-state rules
  - [ ] Auth-required MCPs start disabled
  - [ ] Free/no-auth MCPs start enabled
- [ ] Add capability probe to set initial effective state from real status

## Phase 4 - Defaults and Bootstrap
- [x] Ensure these skills are installed and enabled globally
  - [x] anthropics/skills/frontend-design
  - [x] vercel-labs/skills/find-skills
  - [x] vercel-labs/agent-skills/web-design-guidelines
  - [x] vercel-labs/agent-skills/vercel-react-best-practices
  - [x] astrolicious/agent-skills/astro
- [x] Add post-setup background bootstrap job for defaults
  - [x] Idempotent execution
  - [x] Install/enable default skills
  - [x] Apply MCP defaults
  - [x] Non-blocking behavior on partial failure with warning status

## Phase 5 - Propagation to Existing Projects
- [ ] Add settings propagation controls
  - [ ] "Apply to existing projects" toggle
  - [ ] "Sync now" action
- [ ] Implement sync job to patch each project's preview opencode config
  - [ ] Add
  - [ ] Update
  - [ ] Remove

## Phase 6 - Product Polish
- [ ] Add project menu action: Export preview source (.zip)
- [ ] Export only preview source code
- [ ] Exclude production/runtime artifacts
- [ ] Add "Fix with doce" action to runtime error boundary
- [ ] Add guardrails to avoid conflicts during active agent operations

## Phase 7 - QA Before Release
- [ ] Fresh setup installs/enables default skills
- [ ] First project after fresh install avoids slow image pulls/builds due to prewarm
- [ ] MCP defaults apply with correct enabled/disabled behavior
- [ ] MCP authenticate/logout/test works end-to-end
- [ ] Global settings sync updates existing projects correctly
- [ ] Queue jobs show clear failure messages and can be retried
- [ ] Export preview source zip works on representative projects
- [ ] "Fix with doce" flow works without loops/races

## Explicitly Out of Scope (for now)
- [ ] Import (Astro or non-Astro)
- [ ] AI migration between frameworks
- [ ] Dedicated integrations jobs page (use /queue)
- [ ] Action-level rate limiting
- [ ] Config versioning/migration framework
