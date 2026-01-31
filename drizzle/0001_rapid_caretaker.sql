CREATE TABLE `project_presence` (
	`project_id` text PRIMARY KEY NOT NULL,
	`last_heartbeat_at` integer,
	`stop_at` integer,
	`started_at` integer,
	`is_starting` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_viewers` (
	`viewer_id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_viewers_project_id_idx` ON `project_viewers` (`project_id`);