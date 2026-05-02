CREATE TABLE `system_health_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`taken_at` integer NOT NULL,
	`queue_jobs_queued` integer,
	`queue_jobs_running` integer,
	`queue_jobs_failed` integer,
	`queue_orphaned_jobs` integer,
	`queue_impossible_jobs` integer,
	`projects_total` integer,
	`projects_running` integer,
	`projects_error` integer,
	`projects_healthy_mismatch` integer,
	`opencode_healthy` integer,
	`docker_network_exists` integer,
	`docker_volume_exists` integer,
	`violations_found` integer,
	`violations_healed` integer,
	`reconciliation_duration_ms` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `system_health_snapshots_taken_at_idx` ON `system_health_snapshots` (`taken_at`);--> statement-breakpoint
ALTER TABLE `projects` ADD `desired_status` text DEFAULT 'created' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `observed_status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `last_reconciled_at` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `bootstrap_agent_status` text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `bootstrap_agent_last_activity_at` integer;--> statement-breakpoint
ALTER TABLE `queue_jobs` ADD `healed_at` integer;--> statement-breakpoint
ALTER TABLE `queue_jobs` ADD `heal_reason` text;