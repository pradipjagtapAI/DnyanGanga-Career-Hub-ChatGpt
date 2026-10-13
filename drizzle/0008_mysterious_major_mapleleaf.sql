CREATE TABLE `career_candidate_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`password` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_candidate_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `candidate_account_owner` ON `career_candidate_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_account_provider_unique` ON `career_candidate_accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `career_candidate_link_tokens` (
	`hash` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`user_id` text,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `career_candidate_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_candidate_security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`actor_id` text,
	`outcome` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `career_candidate_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `career_candidate_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_session_token_unique` ON `career_candidate_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `candidate_session_owner` ON `career_candidate_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `career_candidate_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `career_candidate_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`image` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `candidate_email_unique` ON `career_candidate_users` (`email`);--> statement-breakpoint
CREATE TABLE `career_candidate_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `candidate_verification_identifier` ON `career_candidate_verifications` (`identifier`);--> statement-breakpoint
CREATE TRIGGER candidate_identity_immutable BEFORE UPDATE ON career_candidate_users
WHEN NEW.id <> OLD.id
BEGIN SELECT RAISE(ABORT,'candidate identity is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER candidate_account_mapping_immutable BEFORE UPDATE ON career_candidate_accounts
WHEN NEW.user_id <> OLD.user_id OR NEW.provider_id <> OLD.provider_id OR NEW.account_id <> OLD.account_id
BEGIN SELECT RAISE(ABORT,'candidate provider identity mapping is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER candidate_audit_append_only BEFORE UPDATE ON career_candidate_security_events
BEGIN SELECT RAISE(ABORT,'candidate audit records are append only'); END;
