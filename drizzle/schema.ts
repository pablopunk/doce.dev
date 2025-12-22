import { sqliteTable, AnySQLiteColumn, uniqueIndex, foreignKey, text, integer, index } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const projects = sqliteTable("projects", {
	id: text().primaryKey().notNull(),
	ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	createdAt: integer("created_at").notNull(),
	deletedAt: integer("deleted_at"),
	name: text().notNull(),
	slug: text().notNull(),
	prompt: text().notNull(),
	model: text(),
	devPort: integer("dev_port").notNull(),
	opencodePort: integer("opencode_port").notNull(),
	status: text().default("created").notNull(),
	pathOnDisk: text("path_on_disk").notNull(),
	initialPromptSent: integer("initial_prompt_sent").default(0).notNull(),
	initialPromptCompleted: integer("initial_prompt_completed").default(0).notNull(),
	bootstrapSessionId: text("bootstrap_session_id"),
	// Split prompt tracking - separate init and user prompts
	initPromptMessageId: text("init_prompt_message_id"),
	userPromptMessageId: text("user_prompt_message_id"),
	initPromptCompleted: integer("init_prompt_completed").default(0).notNull(),
	userPromptCompleted: integer("user_prompt_completed").default(0).notNull(),
},
(table) => [
	uniqueIndex("projects_slug_unique").on(table.slug),
]);

export const sessions = sqliteTable("sessions", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	tokenHash: text("token_hash").notNull(),
	createdAt: integer("created_at").notNull(),
	expiresAt: integer("expires_at").notNull(),
},
(table) => [
	uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
]);

export const userSettings = sqliteTable("user_settings", {
	userId: text("user_id").primaryKey().notNull().references(() => users.id, { onDelete: "cascade" } ),
	openrouterApiKey: text("openrouter_api_key"),
	defaultModel: text("default_model"),
	updatedAt: integer("updated_at").notNull(),
});

export const users = sqliteTable("users", {
	id: text().primaryKey().notNull(),
	createdAt: integer("created_at").notNull(),
	passwordHash: text("password_hash").notNull(),
	username: text().notNull(),
});

export const queueJobs = sqliteTable("queue_jobs", {
	id: text().primaryKey().notNull(),
	type: text().notNull(),
	state: text().default("queued").notNull(),
	projectId: text("project_id"),
	payloadJson: text("payload_json").notNull(),
	priority: integer().default(0).notNull(),
	attempts: integer().default(0).notNull(),
	maxAttempts: integer("max_attempts").default(3).notNull(),
	runAt: integer("run_at").notNull(),
	lockedAt: integer("locked_at"),
	lockExpiresAt: integer("lock_expires_at"),
	lockedBy: text("locked_by"),
	dedupeKey: text("dedupe_key"),
	dedupeActive: text("dedupe_active"),
	cancelRequestedAt: integer("cancel_requested_at"),
	cancelledAt: integer("cancelled_at"),
	lastError: text("last_error"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	uniqueIndex("queue_jobs_dedupe_idx").on(table.dedupeKey, table.dedupeActive),
	index("queue_jobs_runnable_idx").on(table.state, table.runAt, table.lockExpiresAt),
	index("queue_jobs_project_id_idx").on(table.projectId),
]);

export const queueSettings = sqliteTable("queue_settings", {
	id: integer().primaryKey().notNull(),
	paused: integer().default(0).notNull(),
	concurrency: integer().default(2).notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const drizzleMigrations = sqliteTable("__drizzle_migrations__", {
	id: integer().primaryKey(),
	hash: text().notNull(),
	createdAt: integer("created_at").notNull(),
});

