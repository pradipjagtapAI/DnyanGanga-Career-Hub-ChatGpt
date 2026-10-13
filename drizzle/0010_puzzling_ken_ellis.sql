ALTER TABLE `career_candidate_security_state` ADD `reset_nonce` text;--> statement-breakpoint
ALTER TABLE `career_candidate_security_state` ADD `reset_started_at` integer DEFAULT 0 NOT NULL;