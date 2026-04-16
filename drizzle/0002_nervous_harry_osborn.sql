ALTER TABLE `instance_settings` ADD `tailscale_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `tailscale_auth_key` text;--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `tailscale_hostname` text;--> statement-breakpoint
ALTER TABLE `instance_settings` ADD `tailscale_tailnet_name` text;