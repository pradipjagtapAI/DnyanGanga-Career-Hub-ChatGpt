CREATE TABLE `career_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`target_role` text NOT NULL,
	`description` text NOT NULL,
	`preferences` text NOT NULL,
	`status` text NOT NULL,
	`target_date` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_owner_status` ON `career_goals` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `career_interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`time_zone` text NOT NULL,
	`type` text NOT NULL,
	`meeting_url` text NOT NULL,
	`recruiter_id` text,
	`job_id` text,
	`resume_id` text,
	`notes` text NOT NULL,
	`status` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recruiter_id`) REFERENCES `career_recruiters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `interview_owner_date` ON `career_interviews` (`user_id`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `career_learning_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text,
	`title` text NOT NULL,
	`skill` text NOT NULL,
	`source_job_ids` text NOT NULL,
	`resource_url` text NOT NULL,
	`due_at` text,
	`notes` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `career_goals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `learning_owner_status` ON `career_learning_tasks` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `career_platform_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`revision` integer NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `platform_history_owner` ON `career_platform_history` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `career_recruiter_interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recruiter_id` text NOT NULL,
	`type` text NOT NULL,
	`text` text NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recruiter_id`) REFERENCES `career_recruiters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interaction_owner_recruiter` ON `career_recruiter_interactions` (`user_id`,`recruiter_id`);--> statement-breakpoint
CREATE TABLE `career_recruiters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`company` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`profile_url` text NOT NULL,
	`job_ids` text NOT NULL,
	`last_interaction_at` text,
	`next_follow_up_at` text,
	`notes` text NOT NULL,
	`draft` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recruiter_owner_followup` ON `career_recruiters` (`user_id`,`next_follow_up_at`);--> statement-breakpoint
ALTER TABLE `career_confirmed_answers` ADD `valid_until` text;--> statement-breakpoint
ALTER TABLE `career_confirmed_answers` ADD `reconfirm_at` text;--> statement-breakpoint
ALTER TABLE `career_resume_versions` ADD `metadata` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `career_resume_versions` ADD `archived` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `career_saved_searches` ADD `resume_id` text;--> statement-breakpoint
ALTER TABLE `career_saved_searches` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `career_saved_searches` ADD `frequency` text DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE `career_saved_searches` ADD `min_experience` integer;--> statement-breakpoint
ALTER TABLE `career_saved_searches` ADD `max_experience` integer;--> statement-breakpoint
ALTER TABLE `career_saved_searches` ADD `mandatory_experience` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Preserve disabled legacy campaigns; adding the default alone would reactivate them.
UPDATE career_saved_searches SET status=CASE WHEN enabled=1 THEN 'active' ELSE 'paused' END;
--> statement-breakpoint
CREATE TRIGGER career_platform_history_no_update BEFORE UPDATE ON career_platform_history BEGIN SELECT RAISE(ABORT, 'private history is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER career_recruiter_interactions_no_update BEFORE UPDATE ON career_recruiter_interactions BEGIN SELECT RAISE(ABORT, 'private interactions are append-only'); END;
