# OpenCode Provider Integration - Next Steps & Action Items

## Quick Start (For Implementers)

If you're jumping into implementing this plan, start here.

### Understanding the Current System (30 minutes)

```bash
# Review current architecture
cat src/server/opencode/client.ts          # How we connect to OpenCode
cat src/server/projects/setup.ts           # How we write .env with API key
cat src/server/queue/handlers/projectCreate.ts # How we retrieve user's API key
cat src/actions/settings.ts                # How users currently enter API key
```

**Key insight**: Currently, the OpenRouter API key is stored in SQLite, retrieved during project creation, written to .env, and passed to Docker as an environment variable. The plan replaces this entire flow.

### Understanding OpenCode's Provider System (1 hour)

Read these sections from the comprehensive plan:

1. **OPENCODE_PROVIDER_INTEGRATION_PLAN.md - Section 1**: "How OpenCode Connect Provider Works"
2. **OPENCODE_PROVIDER_INTEGRATION_PLAN.md - Section 2**: "OpenCode SDK Integration"

Focus on understanding:
- How `client.auth.set()` works (that's the key new operation)
- The three auth types: api, oauth, wellknown
- How OpenCode stores credentials in `auth.json`

### Understanding the Proposed Architecture (1 hour)

Read:

1. **OPENCODE_PROVIDER_INTEGRATION_PLAN.md - Section 3**: "Database Changes"
2. **OPENCODE_PROVIDER_INTEGRATION_PLAN.md - Section 5**: "Container Environment"

Key concepts:
- New `providerConnections` table (one row per provider the user connects)
- Updated `userSettings` to track `preferredProviderId`
- New queue handler `opencodeSetProviderCredentials` that calls `client.auth.set()`

### Understanding the UI Changes (30 minutes)

Read:

1. **OPENCODE_PROVIDER_INTEGRATION_PLAN.md - Section 4**: "Settings UI Changes"

Key concepts:
- Replace manual API key input with provider selection
- Add "Add Provider" flow
- Support both API key and OAuth flows

---

## Phase 1: Database Foundation (Week 1)

### Goal
Prepare database for storing provider connections without breaking existing system.

### Checklist

#### Setup (30 min)
- [ ] Create new Drizzle migration file
  ```bash
  touch src/server/db/migrations/001_add_provider_connections.ts
  ```
- [ ] Review Drizzle migration documentation
- [ ] Set up test database

#### Implementation (4 hours)

**Step 1: Create migration SQL** (30 min)
```sql
-- Create new table
CREATE TABLE provider_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  auth_type TEXT NOT NULL CHECK(auth_type IN ('api', 'oauth', 'wellknown')),
  api_key_hash TEXT,
  oauth_refresh_token TEXT,
  oauth_access_token TEXT,
  oauth_expires_at INTEGER,
  oauth_enterprise_url TEXT,
  wellknown_key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK(status IN ('connected', 'expired', 'error', 'revoked')),
  error_message TEXT,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, provider_id)
);

CREATE INDEX idx_provider_connections_user_id ON provider_connections(user_id);
CREATE INDEX idx_provider_connections_status ON provider_connections(status);

-- Update userSettings
ALTER TABLE user_settings ADD COLUMN preferred_provider_id TEXT;
ALTER TABLE user_settings ADD COLUMN provider_auth_initialized INTEGER DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN migration_completed_at INTEGER;
```

**Step 2: Update Drizzle schema** (1 hour)
```typescript
// src/server/db/schema.ts - add providerConnections table definition
// See: OPENCODE_PROVIDER_INTEGRATION_PLAN.md section 3 for full schema
```

**Step 3: Implement provider CRUD functions** (2 hours)
Create `src/server/auth/providers.ts`:
```typescript
// getProviderConnection(userId, providerId)
// getProviderConnections(userId)
// createProviderConnection(userId, providerId, auth)
// updateProviderConnection(id, updates)
// deleteProviderConnection(userId, providerId)
```

**Step 4: Implement credential helpers** (30 min)
Create `src/server/auth/credentials.ts`:
```typescript
// hashApiKey(key: string): string
// retrieveApiKey(connectionId: string): Promise<string>
// validateProviderConnection(connection): boolean
```

#### Testing (2 hours)
- [ ] Unit tests for CRUD functions
- [ ] Unit tests for migration detection
- [ ] Integration test: can store and retrieve provider connection
- [ ] Verify backwards compatibility: old system still works

#### Validation
- [ ] Run migrations on test database
- [ ] Verify schema matches Drizzle types
- [ ] All tests pass
- [ ] Code review approved

---

## Phase 2: Settings Actions (Week 1-2)

### Goal
Implement backend actions for users to connect/disconnect providers.

### Checklist

#### Implementation (6 hours)

**Step 1: Create settings actions** (3 hours)
Update `src/actions/settings.ts`:
```typescript
export const settings = {
  // ... existing: save, get
  
  connectProvider: defineAction({ ... }),
  disconnectProvider: defineAction({ ... }),
  getProviderConnections: defineAction({ ... }),
  listAvailableProviders: defineAction({ ... }),
  initiateOAuth: defineAction({ ... }),
  completeOAuth: defineAction({ ... }),
};
```

See: OPENCODE_PROVIDER_INTEGRATION_PLAN.md section 4 for full implementations.

**Step 2: Add validation** (2 hours)
- Validate provider ID against known providers
- Validate API key format (basic)
- Check for duplicate connections
- Handle errors gracefully

**Step 3: Add logging** (1 hour)
- Log all provider connection attempts
- Log auth failures with sanitized details
- Track successful connections

#### Testing (2 hours)
- [ ] Test connectProvider with valid API key
- [ ] Test connectProvider with invalid API key
- [ ] Test disconnectProvider
- [ ] Test getProviderConnections
- [ ] Test duplicate connection prevention
- [ ] Error handling tests

#### Validation
- [ ] Actions work from Astro pages
- [ ] Database correctly updated
- [ ] Error messages clear and helpful
- [ ] No credential leaks in logs/errors

---

## Phase 3: Queue Handler (Week 2)

### Goal
Automatically set credentials on OpenCode when project starts.

### Checklist

#### Implementation (6 hours)

**Step 1: Create handler** (2 hours)
Create `src/server/queue/handlers/opencodeSetProviderCredentials.ts`

```typescript
export async function handleOpencodeSetProviderCredentials(
  ctx: QueueJobContext
): Promise<void> {
  // 1. Get project + user
  // 2. Get preferred provider from settings
  // 3. Get provider connection
  // 4. Call client.auth.set() on OpenCode
  // 5. Handle errors with retry
}
```

See: OPENCODE_PROVIDER_INTEGRATION_PLAN.md section 5 for full implementation.

**Step 2: Register handler** (30 min)
Update `src/server/queue/queue.worker.ts`:
```typescript
const handlers: Record<string, QueueHandler> = {
  // ... existing
  'opencode.setProviderCredentials': handleOpencodeSetProviderCredentials,
};
```

**Step 3: Update queue job ordering** (1 hour)
Update `src/server/queue/enqueue.ts`:
```typescript
// When enqueuing project setup, add:
// 1. docker.composeUp
// 2. opencode.waitHealthy
// 3. opencode.setProviderCredentials  ← NEW
// 4. opencode.sessionCreate
// 5. opencode.sendInitialPrompt
```

**Step 4: Add retry logic** (2 hours)
```typescript
// Implement exponential backoff for credential setting
// Max 3 attempts, 1s -> 2s -> 4s delays
```

**Step 5: Implement fallback** (30 min)
If provider connection not found:
```typescript
// Fall back to old system: check for openrouterApiKey in userSettings
// This allows Phase 1 & 2 to coexist safely
```

#### Testing (4 hours)
- [ ] Create test project, verify credentials set on OpenCode
- [ ] Test retry logic (mock OpenCode failure)
- [ ] Test fallback to legacy system
- [ ] Test with multiple providers
- [ ] Test with missing credentials (should error gracefully)
- [ ] Test with OAuth tokens

#### Validation
- [ ] Handler executes in correct queue order
- [ ] Credentials successfully set on OpenCode
- [ ] Can send prompts after credentials set
- [ ] Errors logged clearly
- [ ] Performance acceptable (< 500ms overhead)

---

## Phase 4: Settings UI (Week 2-3)

### Goal
Replace manual API key input with provider management UI.

### Checklist

#### Implementation (8 hours)

**Step 1: Create provider list component** (2 hours)
Create `src/components/settings/SettingsProviders.tsx`:
- Display connected providers
- Show last used date
- [Disconnect] buttons
- [+ Add Provider] button

**Step 2: Create add provider dialog** (3 hours)
Create `src/components/settings/AddProviderDialog.tsx`:
- Provider selection list
- Auth type selector (api/oauth)
- Route to appropriate auth component

**Step 3: Create API key auth dialog** (2 hours)
Create `src/components/settings/ApiKeyAuthDialog.tsx`:
- Input field for API key
- Validation feedback
- Save button

**Step 4: Create OAuth dialog (MVP)** (1 hour)
Create `src/components/settings/OAuthDialog.tsx`:
- Simplified: "Click here to authorize"
- Opens browser window
- Manual code entry (device flow)

See: OPENCODE_PROVIDER_INTEGRATION_PLAN.md section 4 for full React code.

#### Testing (3 hours)
- [ ] Can add provider via UI
- [ ] Can see connected providers
- [ ] Can disconnect provider
- [ ] Can add multiple providers
- [ ] Error handling (invalid key, duplicate provider)
- [ ] UI responsive and accessible

#### Validation
- [ ] Works on desktop and mobile
- [ ] Error messages clear
- [ ] No credential leaks in UI
- [ ] Smooth user experience
- [ ] Loading states handled

---

## Phase 5: Testing & Polish (Week 3)

### Goal
Comprehensive testing of end-to-end flow.

### Checklist

#### E2E Testing (6 hours)

**Test 1: User connects provider, creates project**
```
1. Go to Settings
2. Click "+ Add Provider"
3. Select Anthropic
4. Enter API key
5. Create project with Claude model
6. Verify project runs and can chat
7. Claude responds correctly
```

**Test 2: User switches providers between projects**
```
1. User has Anthropic + OpenRouter connected
2. Create project 1 with Anthropic
3. Create project 2 with OpenRouter
4. Verify each project uses correct provider
```

**Test 3: Legacy system fallback**
```
1. User has old API key but no provider connection
2. Create project
3. Verify fallback to legacy system works
```

**Test 4: Error cases**
```
1. Invalid API key → Clear error
2. Duplicate provider → Error + guidance
3. Missing provider when creating project → Fallback or error
4. OpenCode credential setting fails → Retry logic works
```

#### Unit Tests (4 hours)
- [ ] All handler functions have tests
- [ ] Credential helpers tested
- [ ] Migration detection tested
- [ ] Error paths tested

#### Load Testing (2 hours)
- [ ] Creating 10 projects concurrently
- [ ] Verify no race conditions
- [ ] Queue handler performance acceptable

---

## Phase 6: Migration & Launch (Week 4)

### Goal
Guide existing users to new system and document changes.

### Checklist

#### Auto-Migration (4 hours)

**Step 1: Create migration wizard action** (2 hours)
```typescript
export const settings = {
  // ... existing
  migrateToProviderSystem: defineAction({
    handler: async (input, context) => {
      // 1. Check if user has old API key
      // 2. Automatically create provider connection
      // 3. Update preferredProviderId
      // 4. Return success
    }
  })
};
```

**Step 2: Update settings page** (1 hour)
- Show migration prompt if applicable
- "Upgrade to new provider system" button
- Clear explanation of benefits

**Step 3: Auto-run for new users** (1 hour)
- If user has old API key, auto-migrate on next login
- Add UI toast showing migration completed

#### Documentation (3 hours)
- [ ] Update README.md with new provider setup
- [ ] Create admin guide for deploying changes
- [ ] Document rollback procedure
- [ ] Add FAQ about provider system
- [ ] Update AGENTS.md with new architecture

#### Launch Preparation (2 hours)
- [ ] Write release notes
- [ ] Create announcement for users
- [ ] Prepare support responses
- [ ] Set up monitoring for queue handler

#### Post-Launch (Ongoing)
- [ ] Monitor error logs for issues
- [ ] Track migration adoption rate
- [ ] Respond to support tickets
- [ ] Plan Phase 3+ enhancements (OAuth, encryption)

---

## Critical Decision Points

### Before Starting Phase 2, Decide:

**1. Encryption for Phase 1?**
```
Option A: Plain API key hashing only
  Pros: Faster implementation, simpler
  Cons: Keys still visible in memory, less secure

Option B: Implement encryption
  Pros: More secure, future-proof
  Cons: More work, complexity, key management needed
```

**Recommendation for MVP**: Option A (hashing). Upgrade to encryption in Phase 3+.

---

**2. OAuth in MVP?**
```
Option A: API keys only for MVP
  Pros: Faster launch, fewer moving parts
  Cons: Some providers unsupported, users can't use OAuth

Option B: Include OAuth
  Pros: All providers supported from day 1
  Cons: Significantly more work, complexity
```

**Recommendation for MVP**: Option A (API keys only). OAuth in Phase 2.

---

**3. Multi-Provider per Session?**
```
Option A: One provider per session (simple)
  Users can connect multiple providers, but must choose at project creation

Option B: Switch providers mid-session (complex)
  More flexibility, but requires major UI/backend changes

Option C: Hybrid (recommended)
  Multiple providers per user, but one per project/session
  Can create new session if user wants to switch
```

**Recommendation**: Option C (hybrid). Simplest for MVP.

---

## Files to Create/Modify

### New Files
```
src/server/db/migrations/
  └── 001_add_provider_connections.ts

src/server/auth/
  ├── providers.ts              # CRUD for providerConnections
  └── credentials.ts            # Hash/retrieve API keys

src/server/queue/handlers/
  └── opencodeSetProviderCredentials.ts

src/components/settings/
  ├── SettingsProviders.tsx
  ├── AddProviderDialog.tsx
  ├── ApiKeyAuthDialog.tsx
  └── OAuthDialog.tsx

src/components/settings/helpers/
  └── providerHelpers.ts
```

### Modified Files
```
src/server/db/schema.ts          # Add providerConnections table
src/server/queue/queue.worker.ts # Register new handler
src/server/queue/enqueue.ts      # Update job ordering
src/actions/settings.ts          # Add new settings actions
src/pages/settings.astro         # Integrate new UI
```

---

## Testing Checklist

### Unit Tests Required
- [ ] Provider CRUD functions
- [ ] Credential helpers
- [ ] Hash/validation functions
- [ ] Migration detection
- [ ] Error handling

### Integration Tests Required
- [ ] Settings actions with database
- [ ] Queue handler with mock OpenCode
- [ ] Provider connection lifecycle
- [ ] Fallback to legacy system

### E2E Tests Required
- [ ] User flow: connect provider → create project → chat
- [ ] Multiple providers
- [ ] Provider switching
- [ ] Error cases
- [ ] Mobile UI

### Manual Testing Required
- [ ] Settings page UI
- [ ] Add provider flow
- [ ] Disconnect provider
- [ ] Create project with different providers
- [ ] Error messages

---

## Debugging Tips

### If OpenCode Can't Find Credentials:
```typescript
// 1. Check credentials were set:
const client = getOpencodeClient(port);
const auth = await client.auth.set(...); // See response

// 2. Check auth.json exists in container:
docker exec <container> cat /root/.local/share/opencode/auth.json

// 3. Check queue handler ran:
SELECT * FROM queue_jobs WHERE type='opencode.setProviderCredentials' 
  ORDER BY updated_at DESC LIMIT 1;

// 4. Check logs:
docker logs <opencode-container> | grep -i auth
```

### If Credentials Setting Fails:
```typescript
// 1. Check OpenCode health:
curl http://localhost:<port>/doc

// 2. Check API key format:
// OpenRouter: should start with "sk-or-"
// Anthropic: should start with "sk-ant-"

// 3. Check queue worker is running:
ps aux | grep queue.worker

// 4. Check error in logs:
docker logs doce-app | grep "setProviderCredentials"
```

---

## Success Criteria for Each Phase

### Phase 1 ✅
- [x] Database migrated
- [x] No data loss in old system
- [x] CRUD functions work
- [x] Tests pass
- [x] Backwards compatible

### Phase 2 ✅
- [x] Settings actions work
- [x] Can connect providers programmatically
- [x] Validation works
- [x] Error handling clear
- [x] Tests pass

### Phase 3 ✅
- [x] Queue handler runs
- [x] Credentials set on OpenCode
- [x] Fallback works if no provider
- [x] Retry logic works
- [x] Performance acceptable

### Phase 4 ✅
- [x] UI polished and accessible
- [x] User can add/remove providers
- [x] Error messages clear
- [x] Mobile responsive
- [x] Tests pass

### Phase 5 ✅
- [x] E2E flows work
- [x] All error cases handled
- [x] Load testing passed
- [x] Performance acceptable
- [x] Security validated

### Phase 6 ✅
- [x] Users auto-migrated
- [x] Documentation complete
- [x] Support ready
- [x] Monitoring in place
- [x] Rollback plan tested

---

## Estimated Time Breakdown

```
Phase 1: Database & Backend      13 hours
  - Migration + schema            3h
  - CRUD functions                4h
  - Helpers + utilities           3h
  - Testing + validation          3h

Phase 2: Settings Actions        8 hours
  - Actions                       4h
  - Validation + error handling   2h
  - Testing                       2h

Phase 3: Queue Handler           10 hours
  - Handler implementation        4h
  - Retry + error handling        3h
  - Queue ordering                2h
  - Testing                       1h

Phase 4: Settings UI             11 hours
  - React components              6h
  - Styling + accessibility       3h
  - Testing                       2h

Phase 5: Testing & Polish        12 hours
  - E2E testing                   6h
  - Unit tests                    3h
  - Load testing + perf           2h
  - Bug fixes                     1h

Phase 6: Migration & Launch      6 hours
  - Auto-migration                3h
  - Documentation                 2h
  - Launch prep                   1h

TOTAL: ~60 hours = ~2 weeks (at 30h/week)
```

---

## Resources

### Documentation
- `OPENCODE_PROVIDER_INTEGRATION_PLAN.md` - Complete technical guide
- `INTEGRATION_PLAN_SUMMARY.md` - Executive overview
- OpenCode SDK docs - `/manno23/opencode`

### Code References
- Current settings: `src/actions/settings.ts`
- Current project creation: `src/server/queue/handlers/projectCreate.ts`
- Current OpenCode client: `src/server/opencode/client.ts`

### Helpful Tools
- Drizzle migrations: `drizzle-kit generate sqlite`
- Testing framework: Vitest (already in repo)
- Database tool: SQLite CLI or DBeaver

---

Good luck! 🚀

