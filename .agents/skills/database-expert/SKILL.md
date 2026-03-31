---
name: database-expert
description: Expert in SQLite with WAL mode, Drizzle ORM, and better-sqlite3 driver.
---

## Core Expertise
- Database: SQLite with WAL mode for concurrent access
- ORM: Drizzle ORM for type-safe queries
- Driver: better-sqlite3 for synchronous operations
- Schema: Table definitions, constraints, relationships
- Migrations: Schema evolution and version management
- Performance: Indexing, EXPLAIN QUERY PLAN, prepared statements
- Transactions: Multi-step operations with ACID guarantees

## Use Context7 for Documentation
```typescript
// Resolve and fetch Drizzle ORM docs
context7_resolve-library-id({ libraryName: "drizzle-orm" })
context7_query-docs({
  context7CompatibleLibraryID: "/llmstxt/orm_drizzle_team_llms-full_txt",
  query: "migrations schema joins indexes transactions"
})

// Resolve and fetch better-sqlite3 docs
context7_resolve-library-id({ libraryName: "better-sqlite3" })
context7_query-docs({
  context7CompatibleLibraryID: "/wiselibs/better-sqlite3",
  query: "setup transactions performance WAL mode prepared statements"
})
```

## Database Setup
```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

const DB_PATH = process.env.DB_FILE_NAME ?? "data/db.sqlite";
const sqlite = new Database(DB_PATH);

// Enable WAL mode for concurrent access
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export { sqlite }; // Use for performance, pragmas, prepared statements
```

## Schema Definition
```typescript
import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';

export const tableName = sqliteTable("table_name", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status", { enum: ["created", "active", "deleted"] }).default("created"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
  userIdIdx: index("table_user_id_idx").on(table.userId),
  statusCreatedAtIdx: index("table_status_created_idx").on(table.status, table.createdAt),
  slugUnique: unique("table_slug_unique").on(table.slug),
}));

export type Table = typeof tableName.$inferSelect;
export type NewTable = typeof tableName.$inferInsert;
```

## Common Query Patterns

### Import Operators
```typescript
import { db } from './db/client';
import { tables } from './db/schema';
import { eq, and, or, gt, lt, gte, lte, ne, isNull, inArray } from 'drizzle-orm';
import { sql } from "drizzle-orm";
```

### SELECT
```typescript
// Single record
const record = await db.select().from(tables.tableName)
  .where(eq(tables.tableName.id, id))
  .get();

// Multiple with complex filter
const records = await db.select()
  .from(tables.tableName)
  .where(and(
    eq(tables.tableName.userId, userId),
    isNull(tables.tableName.deletedAt),
  ));

// With join
const joined = await db.select({ tableName: tables.tableName, userName: tables.users.name })
  .from(tables.tableName)
  .innerJoin(tables.users, eq(tables.tableName.userId, tables.users.id));

// Order and limit
const recent = await db.select()
  .from(tables.tableName)
  .where(eq(tables.tableName.status, 'queued'))
  .orderBy(tables.tableName.priority)
  .limit(10);
```

### INSERT
```typescript
import { nanoid } from 'nanoid';

const newRecord = await db.insert(tables.tableName).values({
  id: nanoid(),
  name: 'My Record',
  createdAt: new Date(),
}).returning().get();

// Batch insert
await db.insert(tables.tableName).values([
  { id: nanoid(), name: 'Record 1' },
  { id: nanoid(), name: 'Record 2' },
]);
```

### UPDATE
```typescript
await db.update(tables.tableName)
  .set({ status: 'active', updatedAt: new Date() })
  .where(eq(tables.tableName.id, id));
```

### DELETE / Soft Delete
```typescript
// Soft delete
await db.update(tables.tableName)
  .set({ deletedAt: new Date() })
  .where(eq(tables.tableName.id, id));

// Hard delete
await db.delete(tables.tableName).where(eq(tables.tableName.id, id));
```

### Transactions
```typescript
const result = await db.transaction(async (tx) => {
  const parent = await tx.insert(tables.parentTable).values({ ... }).returning().get();
  const children = await tx.insert(tables.childTable).values([
    { parentId: parent.id, ... },
  ]).returning();
  return { parent, children };
}); // Auto-commits on success, rolls back on error
```

### Raw SQL
```typescript
const stats = await db.execute(sql`
  SELECT state, COUNT(*) as count
  FROM queue_jobs
  WHERE created_at >= datetime('now', '-1 hour')
  GROUP BY state
`);

const result = await db.execute(sql`SELECT * FROM projects WHERE slug = ${slug}`);
```

### Prepared Statements (better-sqlite3)
```typescript
const stmt = sqlite.prepare(`SELECT * FROM projects WHERE owner_user_id = ? AND status = ?`);
const userProjects = stmt.all(userId, 'active');
const project = stmt.get(projectId);
```

## Migration Workflow
```bash
# Generate migration from schema changes
pnpm drizzle:migration:create

# Apply pending migrations
pnpm drizzle:migration:migrate

# Launch Drizzle Studio
pnpm drizzle:studio
```

**Migration File Structure:**
```sql
-- drizzle/0003_add_field.sql
ALTER TABLE `table_name` ADD `field_name` text;--> statement-breakpoint
```

## Performance Optimization

### WAL Mode (Already Enabled)
```typescript
sqlite.pragma("journal_mode = WAL");
```

### WAL Checkpoint Management
```typescript
setInterval(() => {
  sqlite.pragma("wal_checkpoint(RESTART)");
}, 60000); // Every 60s
```

### Indexing Strategy
- Analyze query patterns (WHERE, JOIN conditions)
- Check selectivity (low cardinality = less effective)
- Consider write performance impact
- Use composite indexes for multi-column queries
- Test with `EXPLAIN QUERY PLAN`

```typescript
export const myTable = sqliteTable("my_table", {
  col1: text("col1"),
  col2: text("col2"),
}, (table) => ({
  singleIdx: index("my_single_idx").on(table.col1),
  compositeIdx: index("my_composite_idx").on(table.col1, table.col2),
}));
```

## Debugging
```typescript
// Check query execution time
const start = Date.now();
const result = await db.select()...;
console.log(`Query took ${Date.now() - start}ms`);

// Check if index is used
const plan = await db.execute(sql`EXPLAIN QUERY PLAN SELECT * FROM projects WHERE ...`);

// List indexes
const indexes = await db.execute(sql`SELECT * FROM sqlite_master WHERE type = 'index'`);

// Check table info
const stats = await db.execute(sql`PRAGMA table_info(projects)`);
```

## Best Practices
1. Always use context7 for Drizzle and better-sqlite3 syntax
2. Read current schema before making changes
3. Generate migrations after schema changes
4. Use transactions for multi-table operations
5. Add indexes for frequently queried columns (analyze patterns first)
6. Keep transactions short to avoid lock contention
7. WAL mode enabled for concurrent access
8. Use prepared statements for repeated queries
9. Maintain foreign keys with cascade settings
10. Test locally before applying migrations
