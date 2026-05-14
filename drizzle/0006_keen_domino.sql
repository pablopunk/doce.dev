ALTER TABLE `projects` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `projects` SET `description` = `prompt` WHERE `description` = '';