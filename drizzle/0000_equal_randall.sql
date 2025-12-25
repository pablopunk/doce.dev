CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`prompt` text NOT NULL,
	`model` text,
	`dev_port` integer NOT NULL,
	`opencode_port` integer NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`path_on_disk` text NOT NULL,
	`initial_prompt_sent` integer DEFAULT false NOT NULL,
	`initial_prompt_completed` integer DEFAULT false NOT NULL,
	`bootstrap_session_id` text,
	`init_prompt_message_id` text,
	`user_prompt_message_id` text,
	`init_prompt_completed` integer DEFAULT false NOT NULL,
	`user_prompt_completed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
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
	`concurrency` integer DEFAULT 2 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`openrouter_api_key` text,
	`default_model` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL
);
