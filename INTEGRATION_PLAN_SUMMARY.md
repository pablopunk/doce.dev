# OpenCode Provider Integration - Summary & Next Steps

## What Was Analyzed

This summary covers the comprehensive analysis of integrating OpenCode's "Connect Provider" feature into doce.dev, replacing the current manual API key system.

**Primary deliverable**: [`OPENCODE_PROVIDER_INTEGRATION_PLAN.md`](./OPENCODE_PROVIDER_INTEGRATION_PLAN.md) (1890 lines)

## Key Findings

### 1. How OpenCode Manages Providers

OpenCode uses a three-tier authentication system:

| Method | Use Case | Storage | Security |
|--------|----------|---------|----------|
| **API Key** | OpenRouter, Anthropic, custom providers | File-based (restricted permissions) | Hash + file permissions |
| **OAuth** | GitHub Copilot, Google, cloud providers | Encrypted tokens in `auth.json` | Token refresh + expiry |
| **WellKnown** | Enterprise/custom credentials | File-based | Vendor-specific |

**Key Discovery**: OpenCode stores credentials locally in `~/.local/share/opencode/auth.json` with restricted file permissions, NOT via environment variables. doce.dev's current approach (passing `OPENROUTER_API_KEY` via .env) bypasses OpenCode's native security.

### 2. OpenCode SDK Integration Points

```typescript
// Three essential operations:

// 1. List available providers
const { providers } = await client.config.providers();

// 2. Set credentials (what we need to add)
await client.auth.set({
  path: { id: "anthropic" },
  body: { type: "api", key: "sk-ant-..." }
});

// 3. Use provider in sessions
const result = await client.session.prompt({
  path: { id: sessionId },
  body: {
    model: { 
      providerID: "anthropic",  // ← credentials auto-looked up
      modelID: "claude-3-5-sonnet-20241022"
    },
    parts: [...]
  }
});
```

**No environment variables needed** - OpenCode manages everything internally.

### 3. Architecture Improvements

**Current Flow (Problems)**:
```
doce.dev                Docker Container        OpenCode
    ↓                          ↓                    ↓
User enters key  →  Write to .env  →  Read OPENROUTER_API_KEY
                                            ↓
                                    Use for authentication
```

Issues:
- Keys exposed in plaintext in .env
- No separation of concerns
- Bypasses OpenCode's security system
- Difficult to support multiple providers

**New Flow (Proposed)**:
```
doce.dev                Docker Container        OpenCode
    ↓                          ↓                    ↓
User connects     →  Queue handler  →  client.auth.set()
provider               (after health           ↓
                       check)         Keys stored securely
                                       in auth.json
```

Benefits:
- Keys never in .env
- OpenCode's native security
- Multiple providers supported
- Cleaner separation of concerns

## Answers to Your 6 Questions

### Q1: How OpenCode "Connect Provider" Works
**Answer**: Three-part flow:
1. User provides credentials (API key, OAuth token, etc.)
2. `client.auth.set()` stores securely in auth.json
3. Sessions look up credentials by provider ID automatically

See: **PLAN section 1** for detailed OAuth/API key flows

### Q2: OpenCode SDK Integration
**Answer**: 
- `client.config.providers()` - discover available providers
- `client.auth.set()` - set credentials (new responsibility for doce.dev)
- `client.session.prompt()` - automatic credential lookup

See: **PLAN section 2** for complete SDK method reference

### Q3: Database Changes
**Answer**: Add `providerConnections` table to track:
- Which providers user has connected
- Auth type (api/oauth/wellknown)
- Encrypted credentials
- Connection status & last used date

See: **PLAN section 3** for complete schema with Drizzle examples

### Q4: Settings UI Changes
**Answer**: Replace manual API key input with:
- List of connected providers
- [+ Add Provider] button
- Provider selection dialog
- API key or OAuth flow per provider type

See: **PLAN section 4** for React component examples

### Q5: Container Environment
**Answer**: 
- Remove API key from .env
- Add new queue handler: `opencodeSetProviderCredentials`
- Handler calls `client.auth.set()` after OpenCode is healthy
- New queue job ordering: composeUp → waitHealthy → **setProviderCredentials** → sessionCreate → sendPrompt

See: **PLAN section 5** for implementation details

### Q6: Backwards Compatibility
**Answer**: Phase-based migration:
- **Phase 1**: Both systems coexist, users opt-in to new system
- **Phase 2**: Settings UI encourages migration (auto-import old keys)
- **Phase 3**: Deprecate old system (hide from UI, keep DB column)

See: **PLAN section 6** for complete migration strategy

## Implementation Roadmap

### Phase 1: Database & Backend (Week 1)
- [ ] Create `providerConnections` table
- [ ] Add migration helpers
- [ ] Implement provider storage utilities

**Risk**: Low | **Complexity**: Low

### Phase 2: Settings Actions & API (Week 1-2)
- [ ] Implement CRUD actions for providers
- [ ] Add OAuth scaffolding
- [ ] Error handling for provider conflicts

**Risk**: Medium | **Complexity**: Medium

### Phase 3: Queue Handler (Week 2)
- [ ] Create `opencodeSetProviderCredentials` handler
- [ ] Update queue job ordering
- [ ] Implement fallback to legacy system

**Risk**: Medium | **Complexity**: High

### Phase 4: Settings UI (Week 2-3)
- [ ] Redesign settings page
- [ ] Provider management components
- [ ] OAuth flow UI

**Risk**: Low | **Complexity**: Medium

### Phase 5: Testing & Polish (Week 3)
- [ ] E2E tests for full flow
- [ ] Edge case handling
- [ ] Performance optimization

**Risk**: Low | **Complexity**: High

### Phase 6: Migration & Launch (Week 4)
- [ ] Auto-migration of existing users
- [ ] Documentation updates
- [ ] Release notes & announcements

**Risk**: Low | **Complexity**: Medium

**Total**: ~13 days of development (1 developer, 2-3 sprints)

## Security Model

### Current Issues
```
❌ API keys in plaintext in .env files
❌ Keys visible in process listings
❌ No audit trail of credential usage
❌ No expiration/rotation mechanism
```

### Proposed Solution
```
✅ Keys stored in OpenCode's auth.json (file permissions)
✅ Keys never in plaintext in doce.dev
✅ Audit trail via queue handler logging
✅ OAuth token refresh + expiry tracking
✅ Encryption at rest for sensitive tokens (Phase 2)
```

### Implementation Pattern
```typescript
// Store only hash
const apiKeyHash = bcrypt.hashSync(apiKey, 10);

// Retrieve from secure source when needed
const plainKey = await retrieveFromVault(connection.id);

// Pass to OpenCode
await client.auth.set({ path: { id: providerId }, body: { type: 'api', key: plainKey } });

// Never store plaintext in DB after Phase 1
```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Credential setting fails | Medium | High | Retry logic, fallback to legacy |
| OAuth token expires | High | Medium | Track expiry, auto-refresh, UI warning |
| User loses access to old keys | Low | Critical | Keep old table forever, migration wizard |
| Provider configuration mismatch | Low | Medium | Validate against OpenCode's providers |
| Plaintext keys in transition phase | Medium | High | Use separate encryption for Phase 1 |

**Overall Risk**: Low-Medium. Mitigated by phased approach and fallback to legacy system.

## Next Steps for Implementation

### Immediate (Next Sprint Planning)
1. **Review this plan** with team - are there concerns?
2. **Create Jira tickets** for each phase
3. **Estimate effort** per ticket based on Phase 1 complexity
4. **Schedule kick-off** for Phase 1 (DB work)

### Before Phase 1 Begins
1. **Create backup** of current production database
2. **Set up test environment** with test OpenCode instances
3. **Design encryption strategy** for Phase 2+ (if needed)
4. **Audit current code** for hardcoded provider assumptions

### Phase 1 Execution Checklist
- [ ] Create `providerConnections` table migration
- [ ] Write Drizzle schema definitions
- [ ] Implement `hashApiKey()` and `retrieveApiKey()` helpers
- [ ] Create `providerConnections.model.ts` (CRUD functions)
- [ ] Write unit tests for migration logic
- [ ] Update AGENTS.md with new architecture
- [ ] Get code review before merging

## Questions for the Team

1. **Encryption**: Should we implement encryption immediately (Phase 1) or defer to Phase 2?
   - Phase 1 (Immediate): Safer, more work upfront
   - Phase 2 (Later): Faster MVP, risk of leaks during transition

2. **OAuth Priority**: Is OAuth critical for launch, or can we MVP with API keys only?
   - API keys only: Faster launch
   - Include OAuth: More providers, more work

3. **Legacy System Deprecation**: How long to keep old system (1 quarter, forever)?
   - Affects migration pressure and code maintenance

4. **Per-Project Providers**: Should users be able to use different providers per project?
   - Yes: More flexibility, more UI complexity
   - No: Simpler, one provider per user

5. **Multi-Provider Sessions**: Can a session switch between providers mid-conversation?
   - Yes: Complex, requires UI changes
   - No: Simpler, provider locked per session

## Key Documentation Files

| File | Purpose | Status |
|------|---------|--------|
| `OPENCODE_PROVIDER_INTEGRATION_PLAN.md` | Complete technical plan | ✅ Written |
| `OPENCODE_PROVIDER_INTEGRATION_PLAN.md#1` | Q1: How OpenCode works | ✅ Complete |
| `OPENCODE_PROVIDER_INTEGRATION_PLAN.md#2` | Q2: SDK Integration | ✅ Complete |
| `OPENCODE_PROVIDER_INTEGRATION_PLAN.md#3` | Q3: Database schema | ✅ Complete |
| `OPENCODE_PROVIDER_INTEGRATION_PLAN.md#4` | Q4: Settings UI | ✅ Complete |
| `OPENCODE_PROVIDER_INTEGRATION_PLAN.md#5` | Q5: Container setup | ✅ Complete |
| `OPENCODE_PROVIDER_INTEGRATION_PLAN.md#6` | Q6: Backwards compat | ✅ Complete |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 doce.dev Web UI                         │
│              (Astro + React Components)                 │
└────────────┬────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────┐
│              Settings Actions                           │
│  - connectProvider(providerId, authType, credentials)   │
│  - disconnectProvider(providerId)                       │
│  - getProviderConnections()                             │
│  - listAvailableProviders()                             │
└────────────┬────────────────────────────────────────────┘
             │
             ↓ Insert/Update
┌─────────────────────────────────────────────────────────┐
│            doce.dev Database (SQLite)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  providerConnections (NEW)                       │   │
│  │  - id, userId, providerId                        │   │
│  │  - authType, apiKeyHash, oauthTokens             │   │
│  │  - status, lastUsedAt, createdAt                 │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  userSettings (MODIFIED)                         │   │
│  │  - preferredProviderId (NEW)                     │   │
│  │  - openrouterApiKey (DEPRECATED)                 │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  projects (UNCHANGED)                            │   │
│  │  - currentModelProviderId                        │   │
│  │  - currentModelId                                │   │
│  └──────────────────────────────────────────────────┘   │
└────────────┬────────────────────────────────────────────┘
             │
             ↓ Queue Jobs
┌─────────────────────────────────────────────────────────┐
│          Queue System (Background Tasks)                │
│                                                         │
│  1. project.create                                      │
│  2. docker.composeUp                                    │
│  3. opencode.waitHealthy                               │
│  4. opencode.setProviderCredentials (NEW)   ←───────┐  │
│  5. opencode.sessionCreate                           │  │
│  6. opencode.sendInitialPrompt                       │  │
│                                                      │  │
└──────────────────┬─────────────────────────────────┘  │
                   │                                     │
                   ↓                                     │
┌──────────────────────────────────────────────────────┐  │
│   Docker Container (Per-Project)                    │  │
│  ┌─────────────────────────────────────┐            │  │
│  │ .env (Simplified - NO API KEYS)     │            │  │
│  │  DEV_PORT=5173                      │            │  │
│  │  OPENCODE_PORT=11000                │            │  │
│  └─────────────────────────────────────┘            │  │
│  ┌─────────────────────────────────────┐            │  │
│  │ OpenCode Server Instance            │            │  │
│  │  - HTTP API (port 11000)            │            │  │
│  │  - auth.json (credential storage)   │◄───────────┘  │
│  │  - Session management               │               │
│  └─────────────────────────────────────┘               │
└──────────────────────────────────────────────────────┘
                   │
                   ↓ (when sending prompts)
┌──────────────────────────────────────────────────────┐
│        External LLM Providers                        │
│  - Anthropic                                         │
│  - OpenRouter                                        │
│  - Google                                            │
│  - GitHub Copilot                                    │
│  - Custom/Enterprise                                 │
└──────────────────────────────────────────────────────┘
```

## Expected Outcomes

### User Perspective
```
BEFORE:
  1. Go to Settings
  2. Enter OpenRouter API key manually
  3. Validate key
  4. Create project
  5. Can only use OpenRouter

AFTER:
  1. Go to Settings
  2. Click "+ Add Provider"
  3. Select "Anthropic"
  4. Paste API key (or click "Authorize" for OAuth)
  5. Create project with Claude selected
  6. Can use multiple providers
  7. Providers auto-connected for future projects
```

### System Perspective
```
BEFORE:
  - API keys in .env (security issue)
  - Single provider support
  - Manual credential management
  - No audit trail
  - Credential validation only at project creation

AFTER:
  - Credentials in OpenCode's secure auth.json
  - Multiple provider support (per user, per project)
  - Automatic credential initialization
  - Full audit trail via queue logs
  - Credential validation at connection + at use
```

## Conclusion

This plan provides a complete roadmap to migrate doce.dev from manual API key management to OpenCode's native provider system. The phased approach allows for:

✅ **Reduced Risk**: Fallback to legacy system in each phase
✅ **User Flexibility**: Gradual migration, not forced
✅ **Better Security**: Credentials managed by OpenCode
✅ **More Providers**: Easy to support multiple LLM providers
✅ **Cleaner Code**: Clear separation of concerns

**Next Action**: Review this plan with the team and kick off Phase 1 (database + backend foundation).

