CREATE TABLE `public_site_operations_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`operation` text NOT NULL,
	`affected_count` integer NOT NULL,
	`page_size` integer NOT NULL,
	`cursor_used` integer NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "public_site_operations_audit_affected_count_check" CHECK("public_site_operations_audit"."affected_count" >= 0 AND "public_site_operations_audit"."affected_count" <= 1000),
	CONSTRAINT "public_site_operations_audit_page_size_check" CHECK("public_site_operations_audit"."page_size" >= 1 AND "public_site_operations_audit"."page_size" <= 1000)
);
--> statement-breakpoint
CREATE INDEX `idx_public_site_operations_audit_created` ON `public_site_operations_audit` (`created_at`);--> statement-breakpoint
CREATE TABLE `public_site_rate_buckets` (
	`bucket_key` text PRIMARY KEY NOT NULL,
	`attempt_count` integer NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "public_site_rate_buckets_attempt_count_check" CHECK("public_site_rate_buckets"."attempt_count" >= 1 AND "public_site_rate_buckets"."attempt_count" <= 10000)
);
--> statement-breakpoint
CREATE INDEX `idx_public_site_rate_buckets_expires` ON `public_site_rate_buckets` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_public_site_feedback_created` ON `public_site_feedback` (`created_at`);