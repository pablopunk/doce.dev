# Before Release TODO

## Phase 1 - Foundation
- [ ] Refactor settings page to tabs
  - [ ] Providers tab
  - [ ] MCPs tab
  - [ ] Skills tab
  - [ ] General tab
- [ ] Run integration operations through existing queue
  - [ ] Skills discovery sync
  - [ ] Skill install/remove/update
  - [ ] MCP status refresh/test
  - [ ] Global defaults sync to existing projects
- [ ] Keep settings as normal UI with lightweight inline status
- [ ] Link to /queue for full details and retries

## Phase 2 - skills.sh Core
- [ ] Add backend skills service for skills.sh operations
  - [ ] Discover/search
  - [ ] Install
  - [ ] Remove
  - [ ] Update
- [ ] Build Skills tab UI
  - [ ] Search/discovery list
  - [ ] Installed skills list
  - [ ] Install/remove/update actions
  - [ ] Global enable/disable state (all projects)
- [ ] Show skill metadata before install
  - [ ] owner/repo
  - [ ] skill name
  - [ ] install count

## Phase 3 - MCP Core
- [ ] Add MCP settings management for default servers
  - [ ] context7
  - [ ] exa
  - [ ] gh_grep
- [ ] Implement OpenCode-native MCP actions in UI
  - [ ] Authenticate
  - [ ] Logout
  - [ ] Test connection
  - [ ] Enable/Disable
- [ ] Apply initial MCP default-state rules
  - [ ] Auth-required MCPs start disabled
  - [ ] Free/no-auth MCPs start enabled
- [ ] Add capability probe to set initial effective state from real status

## Phase 4 - Defaults and Bootstrap
- [ ] Ensure these skills are installed and enabled globally
  - [ ] anthropics/skills/frontend-design
  - [ ] vercel-labs/skills/find-skills
  - [ ] vercel-labs/agent-skills/web-design-guidelines
  - [ ] vercel-labs/agent-skills/vercel-react-best-practices
  - [ ] astrolicious/agent-skills/astro
- [ ] Add post-setup background bootstrap job for defaults
  - [ ] Idempotent execution
  - [ ] Install/enable default skills
  - [ ] Apply MCP defaults
  - [ ] Non-blocking behavior on partial failure with warning status

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
