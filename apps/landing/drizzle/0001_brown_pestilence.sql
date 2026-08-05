CREATE TABLE `public_site_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`email` text NOT NULL,
	`page` text NOT NULL,
	`message` text NOT NULL,
	`consent` integer NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_public_site_feedback_status_created` ON `public_site_feedback` (`status`,`created_at`);