-- Drop init prompt tracking columns (no longer needed with template pre-initialization)
-- SQLite doesn't support DROP COLUMN directly, so we recreate the table without these columns

CREATE TABLE `projects_new` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_user_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `deleted_at` integer,
  `name` text NOT NULL,
  `slug` text NOT NULL UNIQUE,
  `prompt` text NOT NULL,
  `model` text,
  `dev_port` integer NOT NULL,
  `opencode_port` integer NOT NULL,
  `status` text NOT NULL DEFAULT 'created',
  `path_on_disk` text NOT NULL,
  `initial_prompt_sent` integer NOT NULL DEFAULT 0,
  `initial_prompt_completed` integer NOT NULL DEFAULT 0,
  `bootstrap_session_id` text,
  `user_prompt_message_id` text,
  `user_prompt_completed` integer NOT NULL DEFAULT 0,
  `production_port` integer,
  `production_url` text,
  `production_status` text DEFAULT 'stopped',
  `production_started_at` integer,
  `production_error` text,
  FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE cascade
);--> statement-breakpoint

INSERT INTO `projects_new` 
SELECT `id`, `owner_user_id`, `created_at`, `deleted_at`, `name`, `slug`, `prompt`, `model`, 
       `dev_port`, `opencode_port`, `status`, `path_on_disk`, `initial_prompt_sent`, 
       `initial_prompt_completed`, `bootstrap_session_id`, `user_prompt_message_id`, 
       `user_prompt_completed`, `production_port`, `production_url`, `production_status`, 
       `production_started_at`, `production_error`
FROM `projects`;--> statement-breakpoint

DROP TABLE `projects`;--> statement-breakpoint

ALTER TABLE `projects_new` RENAME TO `projects`;
