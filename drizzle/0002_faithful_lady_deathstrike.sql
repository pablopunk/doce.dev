ALTER TABLE `conversations` ADD `opencode_session_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `initial_prompt` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `bootstrapped` text DEFAULT 'false';
