-- Add production hash tracking for atomic versioned deployments
ALTER TABLE `projects` ADD `production_hash` text;
