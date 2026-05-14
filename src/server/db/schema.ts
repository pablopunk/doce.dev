import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Users table - single admin user
export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	username: text("username").notNull(),
	passwordHash: text("password_hash").notNull(),
});

// Sessions table - DB-backed sessions
export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	tokenHash: text("token_hash").notNull().unique(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

// User settings table - OpenRouter config
export const userSettings = sqliteTable("user_settings", {
	userId: text("user_id")
		.primaryKey()
		.references(() => users.id, { onDelete: "cascade" }),
	openrouterApiKey: text("openrouter_api_key"),
	defaultModel: text("default_model"),
	fastModel: text("fast_model"),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const modelFavorites = sqliteTable(
	"model_favorites",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		provider: text("provider").notNull(),
		modelId: text("model_id").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		userIdIdx: index("model_favorites_user_id_idx").on(table.userId),
	}),
);

// Projects table
export const projects = sqliteTable(
	"projects",
	{
		id: text("id").primaryKey(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		deletedAt: integer("deleted_at", { mode: "timestamp" }),
		name: text("name").notNull(),
		icon: text("icon").notNull().default("✨"),
		slug: text("slug").notNull().unique(),
		prompt: text("prompt").notNull(),
		description: text("description").notNull().default(""),
		devPort: integer("dev_port").notNull(),
		// Deprecated: use desired_status instead. Kept for backward compatibility.
		status: text("status", {
			enum: [
				"created",
				"starting",
				"running",
				"stopping",
				"stopped",
				"error",
				"deleting",
			],
		})
			.notNull()
			.default("created"),
		// Desired state: what we want the project to be
		desiredStatus: text("desired_status", {
			enum: ["created", "running", "stopped", "deleting"],
		})
			.notNull()
			.default("created"),
		// Observed state: what we actually observe
		observedStatus: text("observed_status", {
			enum: ["unknown", "healthy", "unhealthy", "missing", "crashed"],
		})
			.notNull()
			.default("unknown"),
		lastReconciledAt: integer("last_reconciled_at", { mode: "timestamp" }),
		pathOnDisk: text("path_on_disk").notNull(),
		initialPromptSent: integer("initial_prompt_sent", { mode: "boolean" })
			.notNull()
			.default(false),
		initialPromptCompleted: integer("initial_prompt_completed", {
			mode: "boolean",
		})
			.notNull()
			.default(false),
		bootstrapSessionId: text("bootstrap_session_id"),
		// User prompt tracking - session.init is now pre-initialized in template
		userPromptMessageId: text("user_prompt_message_id"),
		userPromptCompleted: integer("user_prompt_completed", { mode: "boolean" })
			.notNull()
			.default(false),
		// Agent status during bootstrap: processing, idle, completed, failed, error
		bootstrapAgentStatus: text("bootstrap_agent_status", {
			enum: ["idle", "processing", "completed", "failed", "error"],
		})
			.notNull()
			.default("idle"),
		// When the agent last produced activity
		bootstrapAgentLastActivityAt: integer("bootstrap_agent_last_activity_at", {
			mode: "timestamp",
		}),
		// Production deployment fields
		productionPort: integer("production_port").notNull(),
		productionUrl: text("production_url"),
		productionStatus: text("production_status", {
			enum: ["queued", "building", "running", "failed", "stopped"],
		})
			.notNull()
			.default("stopped"),
		productionStartedAt: integer("production_started_at", {
			mode: "timestamp",
		}),
		productionError: text("production_error"),
		productionHash: text("production_hash"),
		opencodeErrorCategory: text("opencode_error_category"),
		opencodeErrorCode: text("opencode_error_code"),
		opencodeErrorMessage: text("opencode_error_message"),
		opencodeErrorSource: text("opencode_error_source"),
		opencodeErrorAt: integer("opencode_error_at", { mode: "timestamp" }),
		preferredModel: text("preferred_model"),
	},
	(table) => ({
		ownerUserIdIdx: index("projects_owner_user_id_idx").on(table.ownerUserId),
	}),
);

// Queue jobs table (durable background tasks)
export const queueJobs = sqliteTable(
	"queue_jobs",
	{
		id: text("id").primaryKey(),
		type: text("type").notNull(),
		state: text("state", {
			enum: ["queued", "running", "succeeded", "failed", "cancelled"],
		})
			.notNull()
			.default("queued"),
		projectId: text("project_id"),
		payloadJson: text("payload_json").notNull(),
		priority: integer("priority").notNull().default(0),
		attempts: integer("attempts").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(3),
		runAt: integer("run_at", { mode: "timestamp" }).notNull(),
		lockedAt: integer("locked_at", { mode: "timestamp" }),
		lockExpiresAt: integer("lock_expires_at", { mode: "timestamp" }),
		lockedBy: text("locked_by"),
		dedupeKey: text("dedupe_key"),
		dedupeActive: text("dedupe_active"),
		// Self-healing tracking
		healedAt: integer("healed_at", { mode: "timestamp" }),
		healReason: text("heal_reason"),
		cancelRequestedAt: integer("cancel_requested_at", { mode: "timestamp" }),
		cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
		lastError: text("last_error"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		projectIdIdx: index("queue_jobs_project_id_idx").on(table.projectId),
		runnableIdx: index("queue_jobs_runnable_idx").on(
			table.state,
			table.runAt,
			table.lockExpiresAt,
		),
		dedupeIdx: uniqueIndex("queue_jobs_dedupe_idx").on(
			table.dedupeKey,
			table.dedupeActive,
		),
	}),
);

// Queue settings table (single row)
export const queueSettings = sqliteTable("queue_settings", {
	id: integer("id").primaryKey(),
	paused: integer("paused", { mode: "boolean" }).notNull().default(false),
	concurrency: integer("concurrency").notNull().default(2),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const instanceSettings = sqliteTable("instance_settings", {
	id: integer("id").primaryKey(),
	baseUrl: text("base_url"),
	tailscaleEnabled: integer("tailscale_enabled", { mode: "boolean" })
		.notNull()
		.default(false),
	tailscaleAuthKey: text("tailscale_auth_key"),
	tailscaleHostname: text("tailscale_hostname"),
	tailscaleTailnetName: text("tailscale_tailnet_name"),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type ModelFavorite = typeof modelFavorites.$inferSelect;
export type NewModelFavorite = typeof modelFavorites.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
// System health snapshot for monitoring and diagnostics
export const systemHealthSnapshots = sqliteTable(
	"system_health_snapshots",
	{
		id: text("id").primaryKey(),
		takenAt: integer("taken_at", { mode: "timestamp" }).notNull(),

		// Queue health
		queueJobsQueued: integer("queue_jobs_queued"),
		queueJobsRunning: integer("queue_jobs_running"),
		queueJobsFailed: integer("queue_jobs_failed"),
		queueOrphanedJobs: integer("queue_orphaned_jobs"),
		queueImpossibleJobs: integer("queue_impossible_jobs"),

		// Project health
		projectsTotal: integer("projects_total"),
		projectsRunning: integer("projects_running"),
		projectsError: integer("projects_error"),
		projectsHealthyMismatch: integer("projects_healthy_mismatch"),

		// Infrastructure health
		opencodeHealthy: integer("opencode_healthy", { mode: "boolean" }),
		dockerNetworkExists: integer("docker_network_exists", { mode: "boolean" }),
		dockerVolumeExists: integer("docker_volume_exists", { mode: "boolean" }),

		// Violations
		violationsFound: integer("violations_found"),
		violationsHealed: integer("violations_healed"),

		// Performance
		reconciliationDurationMs: integer("reconciliation_duration_ms"),

		createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	},
	(table) => ({
		takenAtIdx: index("system_health_snapshots_taken_at_idx").on(table.takenAt),
	}),
);

export type QueueJob = typeof queueJobs.$inferSelect;
export type NewQueueJob = typeof queueJobs.$inferInsert;
export type SystemHealthSnapshot = typeof systemHealthSnapshots.$inferSelect;
export type NewSystemHealthSnapshot = typeof systemHealthSnapshots.$inferInsert;
export type QueueSettings = typeof queueSettings.$inferSelect;
export type NewQueueSettings = typeof queueSettings.$inferInsert;
export type InstanceSettings = typeof instanceSettings.$inferSelect;
export type NewInstanceSettings = typeof instanceSettings.$inferInsert;
