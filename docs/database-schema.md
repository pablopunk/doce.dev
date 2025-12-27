# Database Schema

SQLite database using WAL mode for concurrent access. Schema defined with Drizzle ORM.

## Tables Overview

### users

Stores user accounts with password authentication.

| Column | Description |
|--------|-------------|
| id | Primary key (UUID) |
| username | Unique username |
| passwordHash | Argon2 hashed password |
| createdAt | Account creation timestamp |

### sessions

Manages user authentication sessions.

| Column | Description |
|--------|-------------|
| id | Primary key (UUID) |
| userId | Foreign key to users |
| tokenHash | Hashed session token |
| expiresAt | Session expiration time |
| createdAt | Session creation timestamp |

### userSettings

Per-user configuration.

| Column | Description |
|--------|-------------|
| userId | Primary key, foreign key to users |
| openrouterApiKey | User's OpenRouter API key (encrypted) |
| defaultModel | Preferred AI model |

### projects

Core table storing project metadata and state.

| Column | Description |
|--------|-------------|
| id | Primary key (UUID) |
| ownerUserId | Foreign key to users |
| name | AI-generated project name |
| slug | URL-safe unique identifier |
| prompt | User's initial project prompt |
| model | Selected AI model |
| devPort | Allocated preview server port |
| opencodePort | Allocated OpenCode server port |
| status | Current lifecycle state |
| pathOnDisk | Filesystem path to project |
| deletedAt | Soft delete timestamp |

#### Model Tracking Fields
| Column | Description |
|--------|-------------|
| currentModelProviderID | Selected LLM provider ID (e.g., "openai", "anthropic") |
| currentModelID | Selected model ID within provider (e.g., "gpt-4", "claude-3-opus") |

#### Production Deployment Fields
| Column | Description |
|--------|-------------|
| productionPort | Allocated port for production server (null if stopped) |
| productionUrl | Full URL to running production (null if stopped) |
| productionStatus | Deployment state: stopped, queued, building, running, failed |
| productionStartedAt | Timestamp when production became ready (null if not running) |
| productionError | Error message if build/startup failed (null if successful) |

See [Project Lifecycle](./project-lifecycle.md) for status values, [Project Creation Flow](./project-creation-flow.md) for prompt tracking, and [Production Deployment](./production-deployment.md) for deployment details.

### queueJobs

Durable job queue storage.

| Column | Description |
|--------|-------------|
| id | Primary key (UUID) |
| type | Job type identifier |
| state | queued, running, succeeded, failed, cancelled |
| projectId | Optional foreign key to projects |
| payloadJson | JSON-encoded job parameters |
| priority | Higher = processed first |
| attempts | Current retry count |
| runAt | Scheduled execution time |
| dedupeKey | Prevents duplicate jobs |

See [Queue System](./queue-system.md) for details.

### queueSettings

Global queue configuration (single row).

| Column | Description |
|--------|-------------|
| paused | Whether queue processing is paused |
| concurrency | Max concurrent jobs (default: 2) |

## File Location

Database stored at `data/db.sqlite`. Schema defined in `src/server/db/schema.ts`.
