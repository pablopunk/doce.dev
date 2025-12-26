-- Add model tracking columns to support runtime model switching
ALTER TABLE `projects` ADD `current_model_provider_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `current_model_id` text;
