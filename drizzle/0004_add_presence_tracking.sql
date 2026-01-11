-- Add presence tracking tables to persist viewer state across server restarts
-- Fixes issue #14: In-Memory Presence State Not Persisted

-- Create presence table - tracks per-project presence state
CREATE TABLE IF NOT EXISTS `presence` (
	`project_id` text PRIMARY KEY NOT NULL,
	`last_heartbeat_at` integer,
	`stop_at` integer,
	`started_at` integer,
	`is_starting` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Create presence_viewers table - tracks individual viewers per project
CREATE TABLE IF NOT EXISTS `presence_viewers` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`viewer_id` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `presence`(`project_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Create index on project_id and viewer_id for efficient queries
CREATE INDEX IF NOT EXISTS `presence_viewers_project_viewer_idx` ON `presence_viewers` (`project_id`, `viewer_id`);
