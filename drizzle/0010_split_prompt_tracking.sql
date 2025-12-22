-- Add new columns for split prompt tracking
ALTER TABLE `projects` ADD COLUMN `init_prompt_message_id` TEXT;--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `user_prompt_message_id` TEXT;--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `init_prompt_completed` INTEGER DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD COLUMN `user_prompt_completed` INTEGER DEFAULT 0 NOT NULL;--> statement-breakpoint

-- Backfill existing projects: if initialPromptCompleted is true, both prompts are done
UPDATE `projects` SET `init_prompt_completed` = 1, `user_prompt_completed` = 1 WHERE `initial_prompt_completed` = 1;
