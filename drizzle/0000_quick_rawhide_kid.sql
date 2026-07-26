CREATE TABLE `interest_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`audience` text NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`company_name` text,
	`website` text,
	`region` text NOT NULL,
	`goal_days` integer,
	`workout_style` text,
	`partnership_interest` text,
	`discovery_source` text,
	`message` text,
	`consent` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interest_submissions_audience_email_unique` ON `interest_submissions` (`audience`,`email`);