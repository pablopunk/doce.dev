-- Add project presence table for tracking viewer presence and container state
-- This persists presence data that was previously in-memory

CREATE TABLE `project_presence` (
	`project_id` text PRIMARY KEY NOT NULL,
	`viewers_json` text NOT NULL,
	`last_heartbeat_at` integer,
	`stop_at` integer,
	`started_at` integer,
	`is_starting` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_presence_updated_at_idx` ON `project_presence` (`updated_at`);
