-- Migration: 0002_concerned_satana
-- Created at: 2026-02-16T22:17:10.855Z
-- Previous migration: 0001_supreme_yellowjacket

CREATE TABLE `model_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`model_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX `model_favorites_user_id` ON `model_favorites`(`user_id`);
