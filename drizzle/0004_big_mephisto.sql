CREATE TABLE `career_agent_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`summary` text NOT NULL,
	`run_id` text,
	`entity_id` text,
	`manifest` text NOT NULL,
	`manifest_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_activity_owner` ON `career_agent_activity` (`user_id`);--> statement-breakpoint
CREATE TABLE `career_agent_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text,
	`reason` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`search_id` text,
	`goal` text NOT NULL,
	`status` text NOT NULL,
	`settings_revision` integer NOT NULL,
	`context` text NOT NULL,
	`context_hash` text NOT NULL,
	`lease_token` text,
	`lease_until` text,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_run_owner_idempotency` ON `career_agent_runs` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `agent_run_owner` ON `career_agent_runs` (`user_id`);--> statement-breakpoint
CREATE TABLE `career_agent_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'approval' NOT NULL,
	`paused_all` integer DEFAULT 0 NOT NULL,
	`paused_categories` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`vault_revision` integer DEFAULT 0 NOT NULL,
	`answers_revision` integer DEFAULT 0 NOT NULL,
	`feedback_revision` integer DEFAULT 0 NOT NULL,
	`max_jobs_per_run` integer DEFAULT 10 NOT NULL,
	`max_packages_per_run` integer DEFAULT 3 NOT NULL,
	`schedule` text DEFAULT '{"enabled":false,"timeZone":"Asia/Kolkata","runTime":"07:30"}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_agent_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`run_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`category` text NOT NULL,
	`task_key` text NOT NULL,
	`status` text NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`summary` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `career_agent_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_task_owner_run_key` ON `career_agent_tasks` (`user_id`,`run_id`,`task_key`);--> statement-breakpoint
CREATE TABLE `career_answer_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_application_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`job_id` text NOT NULL,
	`resume_id` text,
	`cover_id` text,
	`search_id` text,
	`input` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`snapshot` text NOT NULL,
	`snapshot_hash` text NOT NULL,
	`unknowns` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `package_owner` ON `career_application_packages` (`user_id`);--> statement-breakpoint
CREATE TABLE `career_confirmed_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`question` text NOT NULL,
	`value` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`confirmed_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answer_owner_key` ON `career_confirmed_answers` (`user_id`,`key`);--> statement-breakpoint
CREATE TABLE `career_package_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`package_id` text NOT NULL,
	`snapshot_hash` text NOT NULL,
	`package_revision` integer NOT NULL,
	`settings_revision` integer NOT NULL,
	`status` text NOT NULL,
	`expires_at` text NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `career_application_packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `approval_owner_package` ON `career_package_approvals` (`user_id`,`package_id`);--> statement-breakpoint
CREATE TABLE `career_saved_searches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`preferences` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_search_owner` ON `career_saved_searches` (`user_id`);--> statement-breakpoint
CREATE TABLE `career_vault_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`value` text,
	`classification` text NOT NULL,
	`source` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`confirmed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vault_owner_key` ON `career_vault_facts` (`user_id`,`key`);--> statement-breakpoint
CREATE TABLE `career_vault_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vault_history_owner` ON `career_vault_history` (`user_id`);
--> statement-breakpoint
CREATE TRIGGER agent_activity_no_update BEFORE UPDATE ON career_agent_activity BEGIN SELECT RAISE(ABORT,'Agent audit entries are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER vault_history_no_update BEFORE UPDATE ON career_vault_history BEGIN SELECT RAISE(ABORT,'Knowledge history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER answer_history_no_update BEFORE UPDATE ON career_answer_history BEGIN SELECT RAISE(ABORT,'Answer history is immutable'); END;
