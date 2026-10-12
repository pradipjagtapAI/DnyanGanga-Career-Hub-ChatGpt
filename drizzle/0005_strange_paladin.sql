CREATE TABLE `career_package_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`package_id` text NOT NULL,
	`revision` integer NOT NULL,
	`snapshot` text NOT NULL,
	`snapshot_hash` text NOT NULL,
	`unknowns` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_accounts`(`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`package_id`) REFERENCES `career_application_packages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `package_history_owner_revision` ON `career_package_history` (`user_id`,`package_id`,`revision`);
--> statement-breakpoint
CREATE TRIGGER package_history_no_update BEFORE UPDATE ON career_package_history BEGIN SELECT RAISE(ABORT,'Application snapshot history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER agent_feedback_no_update BEFORE UPDATE ON career_agent_feedback BEGIN SELECT RAISE(ABORT,'Feedback memory is immutable'); END;
