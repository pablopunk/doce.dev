# OpenCode Provider Integration - Quick Reference

## The 6 Questions Answered (One Page Each)

### Q1: How OpenCode "Connect Provider" Works

```
USER FLOW:
1. User clicks "Connect Anthropic"
2. User enters API key: "sk-ant-..."
3. doce.dev calls client.auth.set({ id: "anthropic", body: { type: "api", key: "..." } })
4. OpenCode stores in ~/.local/share/opencode/auth.json
5. Later, when creating session with providerID="anthropic", credentials auto-loaded

STORAGE:
- OpenCode maintains auth.json with restricted permissions (0600)
- doce.dev stores provider connections in DB (new providerConnections table)
- Never passes credentials via environment variables

AUTH TYPES:
- API Key: Simple token (OpenRouter, Anthropic, etc.)
- OAuth: Device flow + tokens (GitHub Copilot, Google, etc.)
- WellKnown: Enterprise credentials
```

**Key Insight**: OpenCode manages credentials internally - doce.dev just coordinates the connection.

---

### Q2: OpenCode SDK Integration

```
THREE KEY OPERATIONS:

1. LIST PROVIDERS
   const { providers } = await client.config.providers();
   // Returns: [{ id: "anthropic", name: "Anthropic", models: [...] }, ...]

2. SET CREDENTIALS (NEW - we add this)
   await client.auth.set({
     path: { id: "anthropic" },
     body: { type: "api", key: "sk-ant-..." }
   });

3. USE IN SESSION
   const result = await client.session.prompt({
     path: { id: sessionId },
     body: {
       model: { 
         providerID: "anthropic",      // ← credentials auto-loaded by OpenCode
         modelID: "claude-3-5-sonnet"
       },
       parts: [{ type: "text", text: "Hello" }]
     }
   });

AVAILABLE METHODS (all already in SDK):
✅ client.config.providers()       - discover providers
✅ client.auth.set()               - set credentials
✅ client.provider.list()          - list configured
✅ client.provider.authorizeOAuth() - OAuth flow
✅ client.session.prompt()         - use provider
```

**Key Insight**: All required SDK methods already exist. We just add credential setting.

---

### Q3: Database Changes

```
NEW TABLE: providerConnections
╔════════════════════════════════════════════════════════════════╗
║ id | userId | providerId | authType | apiKeyHash | status     ║
╠════════════════════════════════════════════════════════════════╣
║ 1  | user1  | anthropic  | api      | $2a$10$... | connected  ║
║ 2  | user1  | openrouter | api      | $2a$10$... | connected  ║
║ 3  | user2  | anthropic  | api      | $2a$10$... | expired    ║
╚════════════════════════════════════════════════════════════════╝

UPDATED: userSettings
- ADD preferredProviderId TEXT (default provider to use)
- ADD providerAuthInitialized BOOLEAN (for migration tracking)
- KEEP openrouterApiKey (for backwards compatibility)

UNCHANGED: projects
- currentModelProviderId (track which provider per project)
- currentModelId (track which model per provider)

MIGRATION: No data loss. Old system coexists with new.
```

**Key Insight**: Simple schema. One row per provider per user. Tracks status + credentials.

---

### Q4: Settings UI Changes

```
BEFORE:
Settings
  └─ API Key Input
      [Enter OpenRouter Key]
      [Save]

AFTER:
Settings
  └─ Connected Providers
      ├─ ✓ Anthropic (connected)
      │   [Edit] [Disconnect]
      ├─ ✓ OpenRouter (connected)
      │   [Edit] [Disconnect]
      └─ [+ Add Provider]
          └─ Select Provider
              ├─ Anthropic ─→ [Enter API Key] ─→ [Connect]
              ├─ OpenRouter ─→ [Enter API Key] ─→ [Connect]
              └─ GitHub Copilot ─→ [OAuth Flow] ─→ [Authorize]
```

**Key Insight**: Single-page: list connections + add new. No complex wizards.

---

### Q5: Container Environment

```
BEFORE (Problem):
settings.ts
  ↓ (get openrouterApiKey)
project.create
  ↓ (write to .env)
setup.ts
  ↓ (OPENROUTER_API_KEY=sk-or-...)
docker-compose up
  ↓
OpenCode reads OPENROUTER_API_KEY
  ↓ (uses for authentication)
Vulnerable: keys in .env, env vars, process listing

AFTER (Solved):
settings.ts
  ↓ (connect provider)
Store in providerConnections table
  ↓
project.create
  ↓ (write .env WITHOUT key)
docker-compose up
  ↓ (wait for health)
[NEW] opencodeSetProviderCredentials handler
  ↓
client.auth.set({ id: "anthropic", key: "sk-ant-..." })
  ↓
OpenCode stores in auth.json
  ↓
session.prompt() → credentials auto-loaded
Secure: keys only in OpenCode's auth.json
```

**Key Insight**: Three new queue steps: health → set credentials → create session.

---

### Q6: Backwards Compatibility

```
PHASE 1 (Dual System):
if (user.providerConnection) {
  // Use new system
  client.auth.set(...)
} else if (user.openrouterApiKey) {
  // Fallback to old system
  client.auth.set("openrouter", user.openrouterApiKey)
}
Result: No forced migration

PHASE 2 (Encourage Migration):
Settings page: "Upgrade to new provider system"
Auto-migrate button
Result: Most users move to new system

PHASE 3 (Deprecate):
Hide old API key input
Log deprecation warnings
Result: Old system sunset
```

**Key Insight**: Phased approach. Never break existing functionality.

---

## Architecture at a Glance

```
doce.dev Settings
    ↓
    Connect Provider Action
    ↓
    Store in providerConnections table
    ↓
    Create Project Queue Job
    ↓
    docker compose up
    ↓
    [NEW] opencodeSetProviderCredentials
    ↓
    client.auth.set(providerId, credentials)
    ↓
    OpenCode auth.json
    ↓
    session.prompt() with providerID
    ↓
    External LLM API
```

---

## Implementation Phases

| Phase | Duration | Focus | Effort |
|-------|----------|-------|--------|
| 1 | Week 1 | Database foundation | Low |
| 2 | Week 1-2 | Settings actions | Medium |
| 3 | Week 2 | Queue handler | High |
| 4 | Week 2-3 | Settings UI | Medium |
| 5 | Week 3 | Testing | High |
| 6 | Week 4 | Migration & launch | Low |
| **Total** | **~2 weeks** | **Full integration** | **~60 hours** |

---

## Critical Files

### Files to Create
```
src/server/auth/
  ├── providers.ts (CRUD for connections)
  └── credentials.ts (hash/retrieve keys)

src/server/queue/handlers/
  └── opencodeSetProviderCredentials.ts

src/components/settings/
  ├── SettingsProviders.tsx
  ├── AddProviderDialog.tsx
  ├── ApiKeyAuthDialog.tsx
  └── OAuthDialog.tsx
```

### Files to Modify
```
src/server/db/schema.ts
src/server/queue/queue.worker.ts
src/server/queue/enqueue.ts
src/actions/settings.ts
src/pages/settings.astro
```

---

## Key Decisions (Before Starting)

**1. Encryption?**
- MVP: Hash only (faster)
- Later: Encrypted storage (safer)

**2. OAuth?**
- MVP: API keys only (simpler)
- Later: OAuth support (more providers)

**3. Multi-Provider?**
- Yes: Users can connect multiple providers
- One per project (not per-session)

---

## Success Looks Like

### User Perspective
```
✓ Users can connect multiple LLM providers
✓ Can switch provider per project without re-entering credentials
✓ No more manual API key copying
✓ Clear UI for managing connections
✓ Automatic fallback if provider disconnects
```

### System Perspective
```
✓ Credentials never in .env
✓ OpenCode manages auth.json securely
✓ Full audit trail in queue logs
✓ Fallback to legacy system if needed
✓ No data loss from old system
✓ Performance overhead < 100ms per project
```

---

## Most Important Things to Remember

1. **OpenCode handles credentials internally** - we just call `client.auth.set()` once
2. **Three new queue steps** - health check → set credentials → create session
3. **Backwards compatible throughout** - old and new systems coexist
4. **Start with Phase 1** - database foundation before anything else
5. **Test heavily** - E2E testing is critical for queue handler reliability

---

## Quick Links

| Document | Purpose |
|----------|---------|
| `OPENCODE_PROVIDER_INTEGRATION_PLAN.md` | Complete technical spec (1890 lines) |
| `INTEGRATION_PLAN_SUMMARY.md` | Executive overview + decisions |
| `INTEGRATION_NEXT_STEPS.md` | Step-by-step implementation guide |
| `OPENCODE_INTEGRATION_QUICK_REFERENCE.md` | This file |

---

## When You're Ready to Code

1. **Read**: OPENCODE_PROVIDER_INTEGRATION_PLAN.md sections 1-3
2. **Understand**: The three-step flow (auth.set → store → use)
3. **Start**: Phase 1 - database and CRUD functions
4. **Use**: INTEGRATION_NEXT_STEPS.md for detailed checklists
5. **Reference**: This quick reference for architecture overview

Good luck! 🚀

