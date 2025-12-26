ALTER TABLE `projects` ADD `production_port` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `production_url` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `production_status` text DEFAULT 'stopped';--> statement-breakpoint
ALTER TABLE `projects` ADD `production_started_at` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `production_error` text;