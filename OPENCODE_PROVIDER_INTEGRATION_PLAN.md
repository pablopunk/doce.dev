# OpenCode Provider Integration Plan for doce.dev

## Executive Summary

This document outlines a comprehensive plan to integrate OpenCode's built-in "Connect Provider" feature into doce.dev, replacing the current manual API key management system. The new approach will:

- **Eliminate manual API key handling** from doce.dev UI
- **Leverage OpenCode's native provider management** for secure credential storage
- **Support multiple providers** (OpenRouter, Anthropic, Google, GitHub Copilot, custom)
- **Enable OAuth flows** for cloud-based providers
- **Maintain backwards compatibility** during a transition period
- **Simplify settings management** for users

**Timeline**: 4 implementation phases over 2-3 sprints

---

## Answers to Key Questions

### 1. How OpenCode "Connect Provider" Works

#### Authentication Mechanisms

OpenCode supports three authentication patterns:

##### A. API Key Authentication
```typescript
// Set API key for a provider
await client.auth.set({
  path: { id: "anthropic" },
  body: { type: "api", key: "sk-ant-..." }
});

// Also supports wellknown and custom providers
await client.auth.set({
  path: { id: "openrouter" },
  body: { type: "api", key: "sk-or-..." }
});
```

**Storage**: OpenCode stores credentials in `~/.local/share/opencode/auth.json` with restricted file permissions (0600).

##### B. OAuth Authentication
```typescript
// Initiate OAuth flow
const result = await client.provider.authorizeOAuth({
  path: { id: "github_copilot" },
  body: { method: 0 }  // method index from provider config
});
// Returns: { url: string, method: "auto" | "code", instructions: string }

// Handle callback (user approves on GitHub)
const success = await client.provider.handleOAuthCallback({
  path: { id: "github_copilot" },
  body: { method: 0, code: "github_auth_code" }
});
```

**Flow**: 
1. User clicks "Connect GitHub Copilot"
2. OpenCode generates OAuth URL + code
3. User visits URL and approves (or enters code for device flow)
4. UI calls `handleOAuthCallback()` with OAuth code
5. OpenCode stores refresh + access tokens securely

##### C. Well-Known Credentials
```typescript
await client.auth.set({
  path: { id: "groq" },
  body: { type: "wellknown", key: "sk-gr-...", token: "..." }
});
```

#### Credential Lifecycle

```
┌─────────────────────────────────────────────┐
│         User Settings / Settings Page       │
├─────────────────────────────────────────────┤
│                                             │
│  [Connect OpenRouter]  [Connect Anthropic] │
│         ↓                      ↓            │
│  ┌──────────────┐      ┌────────────────┐  │
│  │   API Key    │      │  OAuth Dialog  │  │
│  │   Input      │      │  (GitHub)      │  │
│  └──────┬───────┘      └────────┬───────┘  │
│         │                       │          │
└─────────┼───────────────────────┼──────────┘
          │                       │
          ↓                       ↓
    ┌────────────────────────────────────┐
    │   doce.dev Backend (Queue Handler) │
    │   - Validate credentials           │
    │   - Store provider preference      │
    │   - Track connection status        │
    └────────────┬─────────────────────┘
                 │
                 ↓
    ┌────────────────────────────────────┐
    │   OpenCode Server (per-project)    │
    │   - client.auth.set(providerId,    │
    │     credentials)                   │
    │   - Stores in auth.json            │
    │   - Uses for session creation      │
    └────────────────────────────────────┘
```

#### Available Providers

OpenCode discovers providers at runtime via:
```typescript
const { providers, default: defaults } = await client.config.providers();
// Returns list of configured providers with their default models

// Example response:
{
  "providers": [
    { "id": "anthropic", "name": "Anthropic", "models": [...] },
    { "id": "openrouter", "name": "OpenRouter", "models": [...] },
    { "id": "github_copilot", "name": "GitHub Copilot", "models": [...] },
    ...
  ],
  "default": {
    "anthropic": "claude-3-5-sonnet-20241022",
    "openrouter": "auto"
  }
}
```

---

### 2. OpenCode SDK Integration

#### Provider Status & Introspection

**List available providers**:
```typescript
const { providers, default: defaults } = await client.config.providers();
```

**Get provider details**:
```typescript
const provider = providers.find(p => p.id === "anthropic");
// Returns metadata: name, description, models, auth methods, etc.
```

**Check if provider is connected**:
- OpenCode doesn't expose direct API to check if credentials are set
- **Workaround**: Try to create a session with that provider; if it fails with auth error, credentials aren't set
- **Better approach**: Track connection status in doce.dev's own DB

#### Session Creation with Provider

After credentials are set, sessions use them automatically:

```typescript
// Create session - credentials are looked up automatically
const session = await client.session.create({
  body: {
    title: "My Session"
  }
});

// Send prompt with specific provider + model
const result = await client.session.prompt({
  path: { id: session.id },
  body: {
    model: {
      providerID: "anthropic",     // ← Credentials already set via auth.set()
      modelID: "claude-3-5-sonnet-20241022"
    },
    parts: [{ type: "text", text: "Hello" }]
  }
});
```

#### Error Handling

If credentials aren't set or are invalid:
```typescript
// Will return error response
{
  "response": {
    "ok": false,
    "status": 401
  },
  "error": "NamedError: provider credentials not found or invalid"
}
```

#### SDK Methods Required

| Method | Purpose | Current Status |
|--------|---------|-----------------|
| `client.config.providers()` | List available providers | ✓ Available |
| `client.auth.set()` | Set API key credentials | ✓ Available |
| `client.provider.list()` | List configured providers | ✓ Available |
| `client.provider.authorizeOAuth()` | Initiate OAuth | ✓ Available |
| `client.provider.handleOAuthCallback()` | Complete OAuth flow | ✓ Available |
| `client.session.create()` | Create session | ✓ Available |
| `client.session.prompt()` | Use provider in session | ✓ Available |

All required methods are available in OpenCode SDK v2.

---

### 3. Database Changes

#### New Table: `providerConnections`

```sql
CREATE TABLE provider_connections (
  -- Identification
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,  -- "openrouter", "anthropic", "github_copilot", etc.
  
  -- Authentication type and credentials
  auth_type TEXT NOT NULL CHECK(auth_type IN ('api', 'oauth', 'wellknown')),
  
  -- For API key auth
  api_key_hash TEXT,  -- bcrypt or similar - for validation/lookup
  
  -- For OAuth
  oauth_refresh_token TEXT,   -- Encrypted at rest (or file-based)
  oauth_access_token TEXT,    -- Encrypted at rest
  oauth_expires_at INTEGER,   -- timestamp in seconds
  oauth_enterprise_url TEXT,  -- For enterprise GitHub
  
  -- For wellknown
  wellknown_key_hash TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'connected' CHECK(status IN ('connected', 'expired', 'error', 'revoked')),
  error_message TEXT,  -- Last error if status=error
  
  -- Metadata
  last_used_at INTEGER,  -- timestamp
  created_at INTEGER NOT NULL,  -- timestamp
  updated_at INTEGER NOT NULL,  -- timestamp
  
  -- Uniqueness - user can have one connection per provider
  UNIQUE(user_id, provider_id)
);

CREATE INDEX idx_provider_connections_user_id ON provider_connections(user_id);
CREATE INDEX idx_provider_connections_status ON provider_connections(status);
```

#### Enhanced: `userSettings` Table

```sql
-- ADD NEW COLUMNS (don't remove openrouter_api_key for compatibility)
ALTER TABLE user_settings ADD COLUMN preferred_provider_id TEXT;  -- default provider to use
ALTER TABLE user_settings ADD COLUMN provider_auth_initialized INTEGER DEFAULT 0;  -- bool flag
ALTER TABLE user_settings ADD COLUMN migration_completed_at INTEGER;  -- tracks v1->v2 migration
```

#### Enhanced: `projects` Table

```sql
-- Already has these (no changes needed):
-- current_model_provider_id TEXT
-- current_model_id TEXT

-- These are sufficient to track which provider+model each project uses
```

#### Migration Path

```typescript
// During transition period:
// 1. Keep openrouter_api_key in userSettings
// 2. On first provider connection, migrate old key to new system
// 3. After all users migrated, deprecate old column

// Migration logic:
async function migrateUserToProviderSystem(userId: string) {
  const settings = await db.select().from(userSettings)
    .where(eq(userSettings.userId, userId));
  
  if (settings[0]?.openrouterApiKey && !settings[0]?.providerAuthInitialized) {
    // Migrate old key to new system
    await createProviderConnection(userId, 'openrouter', {
      type: 'api',
      key: settings[0].openrouterApiKey
    });
    
    // Mark as migrated
    await db.update(userSettings)
      .set({
        providerAuthInitialized: 1,
        preferredProviderId: 'openrouter'
      })
      .where(eq(userSettings.userId, userId));
  }
}
```

#### Drizzle Schema Definition

```typescript
// src/server/db/schema.ts additions

import { boolean, text } from "drizzle-orm/sqlite-core";

export const providerConnections = sqliteTable(
  "provider_connections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    authType: text("auth_type", { 
      enum: ["api", "oauth", "wellknown"] 
    }).notNull(),
    
    // API key / wellknown credentials
    apiKeyHash: text("api_key_hash"),
    wellknownKeyHash: text("wellknown_key_hash"),
    
    // OAuth tokens
    oauthRefreshToken: text("oauth_refresh_token"),
    oauthAccessToken: text("oauth_access_token"),
    oauthExpiresAt: integer("oauth_expires_at"),
    oauthEnterpriseUrl: text("oauth_enterprise_url"),
    
    // Status
    status: text("status", {
      enum: ["connected", "expired", "error", "revoked"]
    })
      .notNull()
      .default("connected"),
    errorMessage: text("error_message"),
    
    // Metadata
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userProviderIdx: uniqueIndex("idx_provider_user_unique").on(
      table.userId,
      table.providerId
    ),
    userIdIdx: index("idx_provider_user_id").on(table.userId),
    statusIdx: index("idx_provider_status").on(table.status),
  })
);

// Update userSettings
export const userSettings = sqliteTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  
  // Deprecated - keep for backwards compatibility
  openrouterApiKey: text("openrouter_api_key"),
  
  // New provider system
  preferredProviderId: text("preferred_provider_id"),
  providerAuthInitialized: integer("provider_auth_initialized", { 
    mode: "boolean" 
  }).default(false),
  migrationCompletedAt: integer("migration_completed_at", { 
    mode: "timestamp" 
  }),
  
  defaultModel: text("default_model"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type ProviderConnection = typeof providerConnections.$inferSelect;
export type NewProviderConnection = typeof providerConnections.$inferInsert;
```

---

### 4. Settings UI Changes

#### Current Flow (Deprecated)
```
Settings Page
  ↓
[Enter OpenRouter API Key]
  ↓
Validate key
  ↓
Store in userSettings table
  ↓
Pass to .env on project creation
```

#### New Flow

```
Settings Page
  ↓
┌──────────────────────────────────┐
│ Connected Providers Section       │
├──────────────────────────────────┤
│                                  │
│ ✓ OpenRouter (Last used: 2h ago) │
│   [Edit] [Disconnect]            │
│                                  │
│ ✓ Anthropic (Last used: 1d ago)  │
│   [Edit] [Disconnect]            │
│                                  │
│ [+ Add Provider]                 │
│                                  │
└──────────────────────────────────┘
     ↓
     ├─→ [Add Provider] click
     │        ↓
     │   ┌──────────────────────┐
     │   │ Select Provider      │
     │   ├──────────────────────┤
     │   │ • OpenRouter         │
     │   │ • Anthropic          │
     │   │ • Google             │
     │   │ • GitHub Copilot     │
     │   │ • Other (custom)     │
     │   └────────┬─────────────┘
     │            ↓
     │   ┌──────────────────────┐
     │   │ Auth Type Check      │
     │   └────────┬─────────────┘
     │            ├─→ API Key → Enter key field → Validate → Save
     │            └─→ OAuth → Open browser → Approve → Callback
     │
     └─→ [Disconnect] click
            ↓
        Confirm dialog
            ↓
        Delete connection
```

#### UI Components Needed

**1. Provider List Component** (`SettingsProviders.tsx`)
```tsx
import { useState, useEffect } from 'react';
import { useAction } from 'astro:actions';

export function SettingsProviders() {
  const [connections, setConnections] = useState([]);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Load connections and available providers
  useEffect(() => {
    // Fetch from action
    actions.settings.getProviderConnections();
    actions.settings.listAvailableProviders();
  }, []);
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Connected Providers</h3>
        {connections.length === 0 ? (
          <p className="text-muted-foreground">No providers connected yet</p>
        ) : (
          <div className="space-y-2 mt-4">
            {connections.map(conn => (
              <ProviderConnectionItem
                key={conn.id}
                connection={conn}
                onDisconnect={() => {
                  // Call disconnect action
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      <button
        onClick={() => setShowAddDialog(true)}
        className="btn btn-primary"
      >
        + Add Provider
      </button>
      
      {showAddDialog && (
        <AddProviderDialog
          availableProviders={availableProviders}
          onClose={() => setShowAddDialog(false)}
          onConnect={(providerId) => {
            // Call connect action
          }}
        />
      )}
    </div>
  );
}
```

**2. Add Provider Dialog** (`AddProviderDialog.tsx`)
```tsx
export function AddProviderDialog({ availableProviders, onConnect }) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [authMethod, setAuthMethod] = useState<'api' | 'oauth' | null>(null);
  
  if (!selectedProvider) {
    return (
      <Dialog>
        <DialogContent>
          <h2>Select Provider</h2>
          <div className="space-y-2">
            {availableProviders.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className="block w-full text-left p-3 border rounded hover:bg-accent"
              >
                {p.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  const provider = availableProviders.find(p => p.id === selectedProvider);
  const supportedAuthMethods = provider?.authMethods || [];
  
  if (!authMethod) {
    return (
      <AuthMethodSelector
        provider={provider}
        methods={supportedAuthMethods}
        onSelect={setAuthMethod}
      />
    );
  }
  
  if (authMethod === 'api') {
    return (
      <ApiKeyAuthDialog
        provider={provider}
        onConnect={onConnect}
      />
    );
  }
  
  if (authMethod === 'oauth') {
    return (
      <OAuthDialog
        provider={provider}
        onConnect={onConnect}
      />
    );
  }
}
```

**3. API Key Input** (`ApiKeyAuthDialog.tsx`)
```tsx
export function ApiKeyAuthDialog({ provider, onConnect }) {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const connectAction = useAction(actions.settings.connectProvider);
  
  async function handleConnect() {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await connectAction({
        providerId: provider.id,
        authType: 'api',
        apiKey: apiKey
      });
      
      if (result.success) {
        onConnect(provider.id);
      } else {
        setError(result.error || 'Failed to connect');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <Dialog>
      <DialogContent>
        <h2>Connect {provider.name}</h2>
        <input
          type="password"
          placeholder="Enter API key..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="input w-full"
        />
        {error && <p className="text-error text-sm">{error}</p>}
        <button
          onClick={handleConnect}
          disabled={isLoading || !apiKey}
          className="btn btn-primary w-full"
        >
          {isLoading ? 'Connecting...' : 'Connect'}
        </button>
      </DialogContent>
    </Dialog>
  );
}
```

**4. OAuth Dialog** (`OAuthDialog.tsx`)
```tsx
export function OAuthDialog({ provider, onConnect }) {
  const [oauthUrl, setOauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'init' | 'waiting' | 'callback'>('init');
  
  const initiateOAuthAction = useAction(actions.settings.initiateOAuth);
  const completeOAuthAction = useAction(actions.settings.completeOAuth);
  
  async function handleInitiate() {
    setIsLoading(true);
    try {
      const result = await initiateOAuthAction({ providerId: provider.id });
      if (result.url) {
        setOauthUrl(result.url);
        setStep('waiting');
        // Open URL in new window
        window.open(result.url, '_blank');
      }
    } finally {
      setIsLoading(false);
    }
  }
  
  async function handleCallback() {
    setIsLoading(true);
    try {
      const result = await completeOAuthAction({
        providerId: provider.id,
        code: code
      });
      if (result.success) {
        onConnect(provider.id);
      }
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <Dialog>
      <DialogContent>
        {step === 'init' && (
          <>
            <h2>Connect {provider.name}</h2>
            <p className="text-sm text-muted-foreground">
              You'll be redirected to {provider.name} to authorize this connection.
            </p>
            <button
              onClick={handleInitiate}
              disabled={isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? 'Opening...' : 'Open Authorization'}
            </button>
          </>
        )}
        
        {step === 'waiting' && (
          <>
            <h2>Waiting for Authorization</h2>
            <p className="text-sm text-muted-foreground">
              A new window has opened. Please complete the authorization there.
            </p>
            <div className="bg-muted p-4 rounded">
              <p className="text-sm font-mono break-all">{code}</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste authorization code here if using device flow"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input flex-1"
              />
              <button
                onClick={handleCallback}
                disabled={isLoading || !code}
                className="btn btn-primary"
              >
                Verify
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

#### Settings Actions

New actions in `src/actions/settings.ts`:

```typescript
export const settings = {
  // Existing: save, get
  
  // New provider management actions
  listAvailableProviders: defineAction({
    handler: async (_input, context) => {
      const user = context.locals.user;
      if (!user) throw new ActionError({ code: 'UNAUTHORIZED' });
      
      // Get list from any OpenCode instance (or cache it)
      // For MVP: hardcoded list of known providers
      return {
        providers: [
          { id: 'openrouter', name: 'OpenRouter', authMethods: ['api'] },
          { id: 'anthropic', name: 'Anthropic', authMethods: ['api'] },
          { id: 'google', name: 'Google', authMethods: ['oauth'] },
          { id: 'github_copilot', name: 'GitHub Copilot', authMethods: ['oauth'] },
          // ... more providers
        ]
      };
    },
  }),
  
  getProviderConnections: defineAction({
    handler: async (_input, context) => {
      const user = context.locals.user;
      if (!user) throw new ActionError({ code: 'UNAUTHORIZED' });
      
      const connections = await db
        .select({
          id: providerConnections.id,
          providerId: providerConnections.providerId,
          status: providerConnections.status,
          lastUsedAt: providerConnections.lastUsedAt,
          errorMessage: providerConnections.errorMessage,
        })
        .from(providerConnections)
        .where(eq(providerConnections.userId, user.id));
      
      return { connections };
    },
  }),
  
  connectProvider: defineAction({
    accept: 'form',
    input: z.object({
      providerId: z.string(),
      authType: z.enum(['api', 'oauth', 'wellknown']),
      apiKey: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = context.locals.user;
      if (!user) throw new ActionError({ code: 'UNAUTHORIZED' });
      
      try {
        // Store connection
        const connectionId = generateId('prov');
        await db.insert(providerConnections).values({
          id: connectionId,
          userId: user.id,
          providerId: input.providerId,
          authType: input.authType,
          apiKeyHash: input.apiKey ? hashApiKey(input.apiKey) : undefined,
          status: 'connected',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        // Note: actual credential setting happens in queue handler
        // after project container is ready
        
        return { success: true, connectionId };
      } catch (error) {
        throw new ActionError({
          code: 'BAD_REQUEST',
          message: 'Failed to save provider connection'
        });
      }
    },
  }),
  
  disconnectProvider: defineAction({
    accept: 'form',
    input: z.object({
      providerId: z.string(),
    }),
    handler: async (input, context) => {
      const user = context.locals.user;
      if (!user) throw new ActionError({ code: 'UNAUTHORIZED' });
      
      await db.delete(providerConnections)
        .where(
          and(
            eq(providerConnections.userId, user.id),
            eq(providerConnections.providerId, input.providerId)
          )
        );
      
      return { success: true };
    },
  }),
  
  initiateOAuth: defineAction({
    accept: 'form',
    input: z.object({
      providerId: z.string(),
    }),
    handler: async (input, context) => {
      const user = context.locals.user;
      if (!user) throw new ActionError({ code: 'UNAUTHORIZED' });
      
      // This would need to call an OpenCode instance
      // For now, could be a helper that generates OAuth URLs
      // Or could be deferred to client-side logic
      
      // Note: OAuth handling is complex because it requires:
      // 1. Access to an OpenCode instance (which project?)
      // 2. Callback handling
      // 3. Token storage
      
      // MVP approach: redirect to OpenCode web UI
      // Phase 2: implement full OAuth flow
      
      return {
        url: `http://localhost:5000/provider/${input.providerId}/authorize`
      };
    },
  }),
  
  completeOAuth: defineAction({
    accept: 'form',
    input: z.object({
      providerId: z.string(),
      code: z.string(),
    }),
    handler: async (input, context) => {
      const user = context.locals.user;
      if (!user) throw new ActionError({ code: 'UNAUTHORIZED' });
      
      // Handle OAuth callback
      // Store tokens in database (encrypted)
      
      return { success: true };
    },
  }),
};
```

---

### 5. Container Environment & Credential Initialization

#### Current Flow (Deprecated)

```
Project Create Action
  ↓
Write OPENROUTER_API_KEY to .env
  ↓
Docker Compose up (reads .env)
  ↓
OpenCode container starts
  ↓
Initial prompt sent (uses env var)
```

**Problem**: Mixing OpenCode's auth system with doce.dev's env var system.

#### New Flow

```
Project Create (from settings.openrouterApiKey)
  ↓
setupProjectFilesystem() - DON'T write API key to .env
  ↓
enqueueDockerComposeUp()
  ↓
Docker starts, OpenCode container healthy
  ↓
[NEW] enqueueSetProviderCredentials()
  ↓
Call client.auth.set(providerId, credentials) on OpenCode
  ↓
enqueueOpenCodeSessionCreate()
  ↓
Create session with selected model
```

#### Queue Handler: Set Provider Credentials

```typescript
// src/server/queue/handlers/opencodeSetProviderCredentials.ts

import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { projects, providerConnections, userSettings } from '@/server/db/schema';
import { getOpencodeClient } from '@/server/opencode/client';
import { logger } from '@/server/logger';
import type { QueueJobContext } from '../queue.worker';

export async function handleOpencodeSetProviderCredentials(
  ctx: QueueJobContext
): Promise<void> {
  const payload = parsePayload('opencode.setProviderCredentials', ctx.job.payloadJson);
  const { projectId } = payload;

  logger.info({ projectId }, 'Setting provider credentials on OpenCode');

  try {
    await ctx.throwIfCancelRequested();

    // Get project details
    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project[0]) {
      throw new Error('Project not found');
    }

    const opencodeClient = getOpencodeClient(project[0].opencodePort);

    // Get user's preferred provider
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, project[0].ownerUserId))
      .limit(1);

    const providerId = settings[0]?.preferredProviderId || 'openrouter';

    // Get provider connection
    const connection = await db
      .select()
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.userId, project[0].ownerUserId),
          eq(providerConnections.providerId, providerId)
        )
      )
      .limit(1);

    if (!connection[0]) {
      throw new Error(
        `No connection found for provider: ${providerId}`
      );
    }

    // Set credentials on OpenCode based on auth type
    if (connection[0].authType === 'api' && connection[0].apiKeyHash) {
      // For API keys, we need the plaintext key
      // Problem: we hashed it for storage!
      // Solution: either
      //   A. Store plaintext in separate secure location
      //   B. Store in encrypted form with decryption key
      //   C. Only use well-known providers without doce.dev storage

      // For MVP: assume user provides key fresh each time
      // Phase 2: implement secure credential storage

      const apiKey = await decryptApiKey(connection[0].apiKeyHash);
      
      const authResult = await opencodeClient.auth.set({
        path: { id: providerId },
        body: {
          type: 'api',
          key: apiKey
        }
      });

      if (!authResult.response.ok) {
        throw new Error('Failed to set provider credentials on OpenCode');
      }
    } else if (connection[0].authType === 'oauth') {
      // OAuth tokens stored in database
      // Would need to refresh if expired
      
      if (connection[0].oauthExpiresAt && connection[0].oauthExpiresAt < Date.now()) {
        // Token expired - might need refresh
        // This is complex - needs provider-specific refresh logic
      }
      
      // For providers that need token, would need different auth method
      // This is deferred to Phase 2
    }

    // Mark that credentials have been set
    await db
      .update(projects)
      .set({
        // Add column: providerCredentialsSet: boolean
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId));

    logger.info({ projectId, providerId }, 'Provider credentials set');
  } catch (error) {
    logger.error(
      { projectId, error: String(error) },
      'Failed to set provider credentials'
    );
    throw error;
  }
}
```

#### Updated .env File

```bash
# .env (generated by setupProjectFilesystem)

# Port configuration only - NO API KEYS
DEV_PORT=5173
OPENCODE_PORT=11000
PRODUCTION_PORT=5000

# Optional: Provider preference (informational only)
# Actual credentials set via OpenCode auth API
PROVIDER_ID=openrouter
```

#### Queue Job Ordering

```typescript
// src/server/queue/enqueue.ts - updated flow

export async function enqueueProjectSetup(projectId: string) {
  // 1. Docker compose up
  await enqueue('docker.composeUp', { projectId });
  
  // 2. Wait for OpenCode health
  await enqueue('opencode.waitHealthy', { projectId });
  
  // 3. [NEW] Set provider credentials
  await enqueue('opencode.setProviderCredentials', { projectId });
  
  // 4. Create session
  await enqueue('opencode.sessionCreate', { projectId });
  
  // 5. Send initial prompt
  await enqueue('opencode.sendInitialPrompt', { projectId });
}
```

#### Handler Registration

```typescript
// src/server/queue/queue.worker.ts

import { handleOpencodeSetProviderCredentials } from './handlers/opencodeSetProviderCredentials';

const handlers: Record<string, QueueHandler> = {
  // ... existing handlers
  'opencode.setProviderCredentials': handleOpencodeSetProviderCredentials,
};
```

---

### 6. Backwards Compatibility & Migration Strategy

#### Phase 1: Dual System (Sprint 1)

**Goal**: Both old and new systems coexist

- Settings page has **both** old API key input AND new provider buttons
- On project creation:
  - Check if user has provider connections
  - If yes → use new system
  - If no → fall back to old API key
- Old queue handlers continue to work
- New handlers run in parallel

**Code changes**:
- Add `providerConnections` table
- Add `preferredProviderId` to `userSettings`
- Add new settings actions (don't remove old ones)
- Add new queue handlers
- Settings UI shows both options

**User experience**: No forced migration, new features available to opt-in

#### Phase 2: Encourage Migration (Sprint 2)

**Goal**: Guide users to new system

- Settings page: "⚠️ Old API key system. [Migrate to providers](link)"
- Migration wizard:
  1. Detect if user has old API key
  2. Suggest connecting that provider
  3. Auto-import existing key
  4. Update preference to new system
- Mark old API key input as "Legacy"

**Code changes**:
- Add migration assistant action
- Update UI to promote new system
- Auto-detect provider type from key format

**User experience**: Clear upgrade path, no data loss

#### Phase 3: Deprecate Old System (Sprint 3+)

**Goal**: Sunset old system

- Hide legacy API key input by default
- Warn on old key usage: "This method is deprecated"
- Remove old queue handlers
- Keep database column for backwards compatibility

**Code changes**:
- Hide old UI
- Log deprecation warnings
- Document migration path

**User experience**: Minimal - most users already migrated

#### Migration Utility Functions

```typescript
// src/server/auth/providerMigration.ts

export async function migrateUserToProviderSystem(
  userId: string
): Promise<void> {
  const settings = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (!settings[0]?.openrouterApiKey) {
    return; // No key to migrate
  }

  // Check if already migrated
  if (settings[0].providerAuthInitialized) {
    return;
  }

  const apiKey = settings[0].openrouterApiKey;

  // Create provider connection
  await db.insert(providerConnections).values({
    id: generateId('prov'),
    userId: userId,
    providerId: 'openrouter',
    authType: 'api',
    apiKeyHash: hashApiKey(apiKey),
    status: 'connected',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Update settings to mark as migrated
  await db
    .update(userSettings)
    .set({
      preferredProviderId: 'openrouter',
      providerAuthInitialized: true,
      migrationCompletedAt: new Date(),
    })
    .where(eq(userSettings.userId, userId));

  logger.info(
    { userId },
    'User migrated to provider system'
  );
}

export async function canUserUseLegacySystem(userId: string): Promise<boolean> {
  const settings = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return !!settings[0]?.openrouterApiKey && !settings[0]?.providerAuthInitialized;
}
```

---

## Implementation Roadmap

### Phase 1: Database & Backend Foundation (Week 1)

- [ ] Create migration: add `providerConnections` table
- [ ] Update schema types
- [ ] Create provider storage helpers
- [ ] Implement `getProviderCredentials()` utility
- [ ] Add migration detection logic

**Deliverable**: Database ready, utilities available

### Phase 2: Settings Actions & API (Week 1-2)

- [ ] Implement `settings.connectProvider` action
- [ ] Implement `settings.disconnectProvider` action
- [ ] Implement `settings.getProviderConnections` action
- [ ] Implement `settings.listAvailableProviders` action
- [ ] Add OAuth initiation scaffolding (MVP: redirect to URL)
- [ ] Add error handling for provider conflicts

**Deliverable**: Full API ready, can connect providers programmatically

### Phase 3: Queue Handler (Week 2)

- [ ] Create `opencodeSetProviderCredentials` handler
- [ ] Update queue job ordering
- [ ] Add `providerCredentialsSet` column to projects
- [ ] Implement fallback to legacy system if no provider set
- [ ] Add comprehensive logging

**Deliverable**: Credentials set automatically on container startup

### Phase 4: Settings UI (Week 2-3)

- [ ] Create `SettingsProviders.tsx` component
- [ ] Create `ProviderConnectionItem.tsx` component
- [ ] Create `AddProviderDialog.tsx` component
- [ ] Create `ApiKeyAuthDialog.tsx` component
- [ ] Create `OAuthDialog.tsx` (MVP: basic flow)
- [ ] Update settings page layout
- [ ] Add loading states and error handling

**Deliverable**: Users can add/remove providers from UI

### Phase 5: Testing & Refinement (Week 3)

- [ ] E2E tests: create project with provider credentials
- [ ] E2E tests: switch providers
- [ ] E2E tests: disconnect provider
- [ ] Error case testing
- [ ] Performance testing (credential setting overhead)

**Deliverable**: All flows working end-to-end

### Phase 6: Migration & Documentation (Week 4)

- [ ] Create migration wizard action
- [ ] Auto-migrate existing users
- [ ] Update documentation
- [ ] Release notes
- [ ] Deprecation warnings in old system

**Deliverable**: Users guided to new system, docs updated

---

## Security Considerations

### Credential Storage

**Current Approach**: Store API key hashes + implement secure file-based storage

```typescript
// API Key Security Pattern

// Store hash
const apiKeyHash = bcrypt.hashSync(apiKey, 10);
await db.insert(providerConnections).values({
  ...
  apiKeyHash,
  ...
});

// Never store plaintext in database
// When setting on OpenCode: retrieve from user input or secure vault
```

**Future Enhancement**: Encrypted credential storage

```typescript
// Encrypted storage pattern (Phase 2+)
import { encrypt, decrypt } from '@/server/crypto';

const encrypted = encrypt(apiKey, encryptionKey);
await db.insert(providerConnections).values({
  ...
  apiKeyEncrypted: encrypted,
  ...
});

// On use:
const apiKey = decrypt(encrypted, encryptionKey);
```

### OAuth Token Security

```typescript
// OAuth token storage
const encrypted = encrypt(refreshToken, encryptionKey);
await db.insert(providerConnections).values({
  ...
  oauthRefreshToken: encrypted,
  oauthAccessToken: encrypted, // if storing access token
  ...
});
```

### Best Practices

1. **Never log credentials** - check all logging for sensitive data
2. **Use HTTPS** - OAuth callbacks must be HTTPS in production
3. **Validate provider IDs** - whitelist known providers, reject custom ones initially
4. **Check expiration** - OAuth tokens, validate on use
5. **Audit access** - log who accessed what provider when
6. **Separate concerns** - keep OpenCode's auth separate from doce.dev's

---

## Data Flow Diagrams

### Complete Happy Path: User Adds Provider

```
┌─────────────────────────────────────────────────────────────────┐
│ User: "I want to use Claude with my project"                    │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ doce.dev Settings Page                                          │
│ - User clicks [+ Add Provider]                                  │
│ - Selects "Anthropic"                                           │
│ - Pastes API key                                                │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Action: settings.connectProvider({                              │
│   providerId: 'anthropic',                                      │
│   authType: 'api',                                              │
│   apiKey: 'sk-ant-...'                                          │
│ })                                                              │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Server:                                                         │
│ 1. Hash API key (bcrypt)                                        │
│ 2. Insert into providerConnections table                        │
│ 3. Update userSettings.preferredProviderId = 'anthropic'        │
│ 4. Return success                                               │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ User: "Create a new project"                                    │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Action: projects.create({                                       │
│   prompt: "Build a blog...",                                    │
│   model: "claude-3-5-sonnet-20241022"                           │
│ })                                                              │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓ Enqueued Job: project.create
┌─────────────────────────────────────────────────────────────────┐
│ Handler: handleProjectCreate()                                  │
│ - Allocate ports                                                │
│ - Copy template                                                 │
│ - Write .env (NO API KEY)                                       │
│ - Update opencode.json with model                               │
│ - Create project DB record                                      │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓ Enqueued Job: docker.composeUp
┌─────────────────────────────────────────────────────────────────┐
│ Handler: handleDockerComposeUp()                                │
│ - Run docker compose up                                         │
│ - Wait 2s for containers to start                               │
│ - Start streaming logs                                          │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓ Enqueued Job: opencode.waitHealthy
┌─────────────────────────────────────────────────────────────────┐
│ Handler: handleOpencodeWaitHealthy()                            │
│ - Poll /doc endpoint until healthy (max 30s)                    │
│ - Log port and health status                                    │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓ Enqueued Job: opencode.setProviderCredentials [NEW]
┌─────────────────────────────────────────────────────────────────┐
│ Handler: handleOpencodeSetProviderCredentials()                 │
│ 1. Get project details                                          │
│ 2. Get user's preferred provider (anthropic)                    │
│ 3. Get provider connection from DB                              │
│ 4. Call client.auth.set({                                       │
│      path: { id: 'anthropic' },                                 │
│      body: { type: 'api', key: 'sk-ant-...' }                   │
│    })                                                           │
│ 5. Verify auth.response.ok                                      │
│ 6. Mark as credentials set                                      │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓ Enqueued Job: opencode.sessionCreate
┌─────────────────────────────────────────────────────────────────┐
│ Handler: handleOpencodeSessionCreate()                          │
│ - Create empty session for bootstrap                            │
│ - Store session ID in DB                                        │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓ Enqueued Job: opencode.sendInitialPrompt
┌─────────────────────────────────────────────────────────────────┐
│ Handler: handleOpencodeSendInitialPrompt()                      │
│ - Get project and session                                       │
│ - Send prompt with:                                             │
│   model: {                                                      │
│     providerID: 'anthropic',  ← from DB                         │
│     modelID: 'claude-3-5-sonnet-20241022'  ← from DB            │
│   }                                                             │
│ - OpenCode looks up 'anthropic' provider                         │
│ - Finds credentials from auth.set() earlier                     │
│ - Uses them for API call to Anthropic                           │
│ - Stream response back to UI                                    │
└────────┬────────────────────────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Result: Claude is streaming response to user                    │
│ No API key ever exposed in doce.dev or env vars                 │
└─────────────────────────────────────────────────────────────────┘
```

### Error Path: Provider Credentials Not Set

```
Session Creation (from UI)
  ↓
client.session.prompt({
  model: { providerID: 'anthropic', modelID: '...' }
})
  ↓
OpenCode looks for 'anthropic' credentials
  ↓
NOT FOUND (auth.set wasn't called)
  ↓
Returns: { response: { ok: false, status: 401 } }
  ↓
UI shows error: "Provider not configured. Go to settings."
  ↓
User goes to Settings
  ↓
See "Anthropic" listed but status = "Expired" or "Error"
  ↓
Click [Edit] → Re-enter API key
  ↓
Success
```

---

## Cost Analysis

### Operational Changes

| Aspect | Current | New | Impact |
|--------|---------|-----|--------|
| **API Key Storage** | DB plaintext | DB hashed/encrypted | Secure ✅ |
| **Env Var Management** | Write to .env | Remove | Simpler ✅ |
| **Queue Handlers** | 5 | 6 | +1 handler |
| **DB Queries** | 2 | 3 | Minimal |
| **Network Calls** | 1/project | 2/project | Negligible |
| **Latency** | Same | +100ms* | Acceptable |

*Adding credential setting call to OpenCode. One-time per project creation.

### Development Effort

| Phase | Estimate | Scope |
|-------|----------|-------|
| 1. DB & Backend | 3 days | Schema, migrations, utilities |
| 2. Settings Actions | 2 days | CRUD actions for providers |
| 3. Queue Handler | 1 day | Credential initialization |
| 4. UI Components | 3 days | Settings page redesign |
| 5. Testing | 2 days | E2E, edge cases |
| 6. Migration & Docs | 2 days | Auto-migration, documentation |
| **Total** | **13 days** | One developer, ~2 weeks |

---

## Risk Analysis

### Risk 1: Credential Setting Fails
**Likelihood**: Medium | **Impact**: High

**Mitigation**:
- Retry with exponential backoff (3 attempts)
- Clear error logging
- Fallback: Keep old system working in parallel
- Alert user if credentials can't be set

**Code**:
```typescript
async function setProviderWithRetry(client, providerId, credentials, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await client.auth.set({
        path: { id: providerId },
        body: { type: 'api', key: credentials }
      });
      if (result.response.ok) return result;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

### Risk 2: OAuth Token Expiry
**Likelihood**: High | **Impact**: Medium

**Mitigation**:
- Track expiry times
- Auto-refresh before expiry
- Show expiry warning in UI
- Graceful degradation when expired

**Code**:
```typescript
function isTokenExpiring(connection) {
  if (!connection.oauthExpiresAt) return false;
  const expiresIn = connection.oauthExpiresAt - Date.now();
  return expiresIn < 60 * 60 * 1000; // Warn if < 1 hour
}
```

### Risk 3: Migration Data Loss
**Likelihood**: Low | **Impact**: Catastrophic

**Mitigation**:
- Keep old `openrouterApiKey` column indefinitely
- Never delete old data during migration
- Dry-run migration before deployment
- Rollback plan: restore from backup

**Code**:
```typescript
// Never do this:
// await db.schema.dropColumn(userSettings, 'openrouter_api_key');

// Instead, mark as deprecated:
// Add comment in schema: "DEPRECATED: use providerConnections instead"
```

### Risk 4: Provider Configuration Mismatch
**Likelihood**: Low | **Impact**: Medium

**Mitigation**:
- Validate provider IDs against OpenCode's available providers
- Auto-discover provider list at startup
- Show clear error if provider isn't available
- Fallback to default provider

**Code**:
```typescript
async function getAvailableProviders(opencodePort) {
  try {
    const { providers } = await getOpencodeClient(opencodePort).config.providers();
    return providers.map(p => p.id);
  } catch {
    // Fallback to known providers
    return ['openrouter', 'anthropic', 'google'];
  }
}

function validateProviderId(providerId, availableProviders) {
  if (!availableProviders.includes(providerId)) {
    throw new Error(`Provider not available: ${providerId}`);
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// src/server/auth/providerMigration.test.ts
describe('Provider Migration', () => {
  it('migrates old API key to provider connection', async () => {
    // Setup: user with old API key
    await db.insert(userSettings).values({ openrouterApiKey: 'sk-...' });
    
    // Execute migration
    await migrateUserToProviderSystem(userId);
    
    // Assert: new connection created
    const connection = await db.select().from(providerConnections)
      .where(eq(providerConnections.userId, userId));
    expect(connection).toBeDefined();
    expect(connection[0].providerId).toBe('openrouter');
  });
});
```

### Integration Tests

```typescript
// Test credential setting in queue handler
describe('Queue: opencodeSetProviderCredentials', () => {
  it('sets credentials on OpenCode instance', async () => {
    // Setup: project + provider connection
    const project = await createTestProject();
    const connection = await createTestProviderConnection();
    
    // Execute handler
    await handleOpencodeSetProviderCredentials({ job: { ... } });
    
    // Assert: OpenCode auth.set was called
    expect(mockOpencodeClient.auth.set).toHaveBeenCalledWith({
      path: { id: 'openrouter' },
      body: { type: 'api', key: expect.any(String) }
    });
  });
});
```

### E2E Tests

```typescript
// Test full flow: user creates project with provider
describe('E2E: Create project with provider', () => {
  it('creates project and initializes credentials', async () => {
    // Setup: user connects provider
    await connectProvider(userId, 'anthropic', { type: 'api', key: 'sk-ant-...' });
    
    // Execute: create project
    const project = await createProject({ prompt: '...', model: 'claude-...' });
    
    // Wait for queue to process
    await waitForQueueCompletion(project.id, 30000);
    
    // Assert: project is running
    expect(project.status).toBe('running');
    
    // Assert: can interact with project (uses correct provider)
    const response = await sendPrompt(project.id, 'Hello');
    expect(response).toBeDefined();
    expect(response.content).toContain('text'); // Claude responded
  });
});
```

---

## Implementation Examples

### Example 1: Complete Settings Action

```typescript
// src/actions/settings.ts
export const settings = {
  connectProvider: defineAction({
    accept: 'form',
    input: z.object({
      providerId: z.string().min(1),
      authType: z.enum(['api', 'oauth', 'wellknown']),
      apiKey: z.string().optional(),
      oauthCode: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = context.locals.user;
      if (!user) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'Must be logged in'
        });
      }

      try {
        // Validate provider ID
        const knownProviders = ['openrouter', 'anthropic', 'google', 'github_copilot'];
        if (!knownProviders.includes(input.providerId)) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'Invalid provider'
          });
        }

        // Handle API key auth
        if (input.authType === 'api' && input.apiKey) {
          const connectionId = generateId('prov');
          
          await db.insert(providerConnections).values({
            id: connectionId,
            userId: user.id,
            providerId: input.providerId,
            authType: 'api',
            apiKeyHash: hashApiKey(input.apiKey),
            status: 'connected',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Update preferred provider
          await db.update(userSettings)
            .set({ preferredProviderId: input.providerId })
            .where(eq(userSettings.userId, user.id));

          return { success: true, connectionId };
        }

        // Handle OAuth (simplified)
        if (input.authType === 'oauth') {
          // OAuth is complex - Phase 2
          throw new ActionError({
            code: 'NOT_IMPLEMENTED',
            message: 'OAuth coming soon'
          });
        }

        throw new ActionError({
          code: 'BAD_REQUEST',
          message: 'Invalid auth configuration'
        });
      } catch (error) {
        logger.error({ userId: user.id, error }, 'Connect provider failed');
        throw error;
      }
    },
  }),
};
```

### Example 2: Queue Handler

```typescript
// src/server/queue/handlers/opencodeSetProviderCredentials.ts
export async function handleOpencodeSetProviderCredentials(
  ctx: QueueJobContext
): Promise<void> {
  const payload = parsePayload(
    'opencode.setProviderCredentials',
    ctx.job.payloadJson
  );
  const { projectId } = payload;

  logger.info({ projectId }, 'Setting provider credentials');

  try {
    await ctx.throwIfCancelRequested();

    const project = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
      .then(rows => rows[0]);

    if (!project) {
      throw new Error('Project not found');
    }

    const opencodeClient = getOpencodeClient(project.opencodePort);

    // Get preferred provider
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, project.ownerUserId))
      .limit(1)
      .then(rows => rows[0]);

    const providerId = settings?.preferredProviderId || 'openrouter';

    // Get connection
    const connection = await db
      .select()
      .from(providerConnections)
      .where(
        and(
          eq(providerConnections.userId, project.ownerUserId),
          eq(providerConnections.providerId, providerId)
        )
      )
      .limit(1)
      .then(rows => rows[0]);

    if (!connection) {
      // Fallback to legacy system
      logger.warn(
        { projectId, providerId },
        'No provider connection, trying legacy key'
      );
      
      if (settings?.openrouterApiKey) {
        // Use old key as fallback
        const apiKey = settings.openrouterApiKey;
        await opencodeClient.auth.set({
          path: { id: 'openrouter' },
          body: { type: 'api', key: apiKey }
        });
      } else {
        throw new Error('No provider credentials available');
      }
    } else {
      // Set new system credentials
      if (connection.authType === 'api' && connection.apiKeyHash) {
        // Get plaintext key (would be from vault in production)
        const apiKey = await retrieveApiKey(connection);
        
        await opencodeClient.auth.set({
          path: { id: providerId },
          body: { type: 'api', key: apiKey }
        });
      }
    }

    logger.info({ projectId, providerId }, 'Provider credentials set');
  } catch (error) {
    logger.error({ projectId, error: String(error) }, 'Set credentials failed');
    throw error;
  }
}
```

---

## FAQ

### Q: Will existing projects break?
**A**: No. The new system falls back to the old API key system if no provider connection exists.

### Q: Can users use multiple providers?
**A**: Yes, per the new schema. They can connect multiple providers and select which one to use per project (via `projects.currentModelProviderId`).

### Q: How are API keys stored securely?
**A**: Currently hashed. In production, use encrypted storage or hardware HSM. Phase 2 enhancement.

### Q: What about OAuth token refresh?
**A**: Deferred to Phase 2. MVP assumes manual reconnection if expired.

### Q: Can we remove the old API key system entirely?
**A**: Yes, but recommended to keep for 1-2 quarters for backwards compatibility.

### Q: How does this affect production deployments?
**A**: Production deployments use the same provider system. Credentials are set once and persist in the OpenCode container.

### Q: Do we need per-container auth, or system-wide?
**A**: Per-container (as currently designed). Each project's OpenCode instance has its own auth.json. This allows different projects to use different providers.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Provider** | LLM provider (Anthropic, OpenRouter, etc.) |
| **Connection** | User's authenticated link to a provider (stored in providerConnections table) |
| **Credential** | API key, OAuth token, or other auth material |
| **Provider ID** | Unique identifier: "openrouter", "anthropic", etc. |
| **Auth Type** | How credentials are stored: "api", "oauth", "wellknown" |
| **Session** | OpenCode conversation/context (unchanged from current system) |
| **Model** | Specific LLM within a provider (e.g., "claude-3.5-sonnet") |

---

## References

- OpenCode SDK: `/manno23/opencode`
- Current doce.dev Architecture: `src/server/opencode/`, `src/server/queue/`
- Authentication Pattern: `src/server/auth/`
- Settings System: `src/actions/settings.ts`, `src/server/settings/`

