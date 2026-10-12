CREATE TABLE `career_ai_daily_usage` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	`tokens_reserved` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_owner_day` ON `career_ai_daily_usage` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `career_ai_global_daily` (
	`day` text PRIMARY KEY NOT NULL,
	`tokens_reserved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `career_ai_leases` (
	`user_id` text PRIMARY KEY NOT NULL,
	`usage_id` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_ai_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mode` text NOT NULL,
	`job_id` text,
	`resume_id` text,
	`resume_version` integer,
	`profile_revision` integer NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`reserved_tokens` integer NOT NULL,
	`actual_tokens` integer,
	`status` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`settled_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_alert_dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`local_date` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`consent_revision` integer NOT NULL,
	`job_ids` text NOT NULL,
	`destination_address` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`provider_message_id` text,
	`error_code` text,
	`lease_until` text,
	`next_attempt_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`accepted_at` text,
	`delivered_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dispatch_owner_day_channel` ON `career_alert_dispatches` (`user_id`,`local_date`,`channel`);--> statement-breakpoint
CREATE TABLE `career_alert_job_dedupe` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`job_id` text NOT NULL,
	`dispatch_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_job_owner_channel` ON `career_alert_job_dedupe` (`user_id`,`channel`,`job_id`);--> statement-breakpoint
CREATE TABLE `career_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original_key` text NOT NULL,
	`preview_key` text,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`status` text NOT NULL,
	`extracted` text,
	`confirmed_resume_id` text,
	`error_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `document_owner` ON `career_documents` (`user_id`);--> statement-breakpoint
CREATE TABLE `career_destination_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`address` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	`provider_message_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_generated_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`profile_revision` integer NOT NULL,
	`resume_id` text,
	`job_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_notification_destinations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`address` text NOT NULL,
	`verified_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `destination_owner_channel` ON `career_notification_destinations` (`user_id`,`channel`);--> statement-breakpoint
CREATE TABLE `career_provider_events` (
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`created_at` text NOT NULL,
	`processed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_event_identity` ON `career_provider_events` (`provider`,`event_id`);--> statement-breakpoint
CREATE TABLE `career_provider_health` (
	`provider` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`last_checked_at` text,
	`error_code` text
);
--> statement-breakpoint
CREATE TABLE `career_scheduler_state` (
	`key` text PRIMARY KEY NOT NULL,
	`cursor` text,
	`lease_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `career_accounts` ADD `notification_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `career_jobs` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `career_jobs` ADD `source_job_id` text;--> statement-breakpoint
ALTER TABLE `career_jobs` ADD `last_checked_at` text;--> statement-breakpoint
ALTER TABLE `career_jobs` ADD `rights_config_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `job_owner_source_id` ON `career_jobs` (`user_id`,`source`,`source_job_id`);--> statement-breakpoint
ALTER TABLE `career_resume_versions` ADD `document_id` text;