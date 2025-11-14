CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`model` text DEFAULT 'openai/gpt-4o-mini',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`container_id` text,
	`url` text NOT NULL,
	`status` text DEFAULT 'building',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`streaming_status` text DEFAULT 'complete',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`user_id` text,
	`status` text DEFAULT 'draft',
	`preview_url` text,
	`deployed_url` text,
	`build_logs` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);