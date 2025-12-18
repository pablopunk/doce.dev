CREATE TABLE `queue_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`project_id` text,
	`payload_json` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`run_at` integer NOT NULL,
	`locked_at` integer,
	`lock_expires_at` integer,
	`locked_by` text,
	`dedupe_key` text,
	`dedupe_active` text,
	`cancel_requested_at` integer,
	`cancelled_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `queue_jobs_project_id_idx` ON `queue_jobs` (`project_id`);--> statement-breakpoint
CREATE INDEX `queue_jobs_runnable_idx` ON `queue_jobs` (`state`,`run_at`,`lock_expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `queue_jobs_dedupe_idx` ON `queue_jobs` (`dedupe_key`,`dedupe_active`);--> statement-breakpoint
CREATE TABLE `queue_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
