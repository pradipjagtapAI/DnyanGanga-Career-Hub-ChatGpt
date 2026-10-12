ALTER TABLE `career_alert_dispatches` ADD `profile_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `career_alert_dispatches` ADD `resume_id` text;--> statement-breakpoint
ALTER TABLE `career_alert_dispatches` ADD `resume_version` integer;