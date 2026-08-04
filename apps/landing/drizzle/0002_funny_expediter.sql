CREATE TABLE `public_site_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`path` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_public_site_events_created` ON `public_site_events` (`created_at`);