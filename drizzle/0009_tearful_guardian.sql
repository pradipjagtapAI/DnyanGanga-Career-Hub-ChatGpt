CREATE TABLE `career_candidate_security_state` (
	`user_id` text PRIMARY KEY NOT NULL,
	`recovery_pending` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `career_candidate_users`(`id`) ON UPDATE no action ON DELETE cascade
);
