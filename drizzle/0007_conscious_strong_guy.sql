CREATE TABLE `career_admin_accounts` (
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
	FOREIGN KEY (`user_id`) REFERENCES `career_admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admin_account_owner` ON `career_admin_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `admin_account_provider_unique` ON `career_admin_accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `career_admin_bootstrap` (
	`key` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`status` text NOT NULL,
	`user_id` text,
	`created_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `career_admin_memberships` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`generation` integer DEFAULT 0 NOT NULL,
	`workspace_user_id` text NOT NULL,
	`created_by_owner` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_admin_mfa_proofs` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`generation` integer NOT NULL,
	`verified_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `career_admin_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `career_admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_admin_security_events` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`actor_id` text,
	`outcome` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `career_admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	FOREIGN KEY (`user_id`) REFERENCES `career_admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_session_token_unique` ON `career_admin_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `admin_session_owner` ON `career_admin_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `career_admin_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `career_admin_totp_replay` (
	`hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_admin_two_factors` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`verified` integer DEFAULT 1,
	`failed_verification_count` integer DEFAULT 0,
	`locked_until` text,
	FOREIGN KEY (`user_id`) REFERENCES `career_admin_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `admin_totp_owner` ON `career_admin_two_factors` (`user_id`);--> statement-breakpoint
CREATE INDEX `admin_totp_secret` ON `career_admin_two_factors` (`secret`);--> statement-breakpoint
CREATE TABLE `career_admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`image` text,
	`two_factor_enabled` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_email_unique` ON `career_admin_users` (`email`);--> statement-breakpoint
CREATE TABLE `career_admin_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_verification_identifier` ON `career_admin_verifications` (`identifier`);
--> statement-breakpoint
CREATE TRIGGER admin_membership_owner_only BEFORE INSERT ON career_admin_memberships
WHEN NEW.role <> 'owner' OR NEW.workspace_user_id <> NEW.created_by_owner
BEGIN SELECT RAISE(ABORT,'administrator mapping must be owner proved'); END;
--> statement-breakpoint
CREATE TRIGGER admin_membership_mapping_immutable BEFORE UPDATE ON career_admin_memberships
WHEN NEW.user_id <> OLD.user_id OR NEW.role <> OLD.role OR NEW.workspace_user_id <> OLD.workspace_user_id OR NEW.created_by_owner <> OLD.created_by_owner
BEGIN SELECT RAISE(ABORT,'administrator identity mapping is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER admin_audit_append_only BEFORE UPDATE ON career_admin_security_events
BEGIN SELECT RAISE(ABORT,'administrator audit records are append only'); END;
