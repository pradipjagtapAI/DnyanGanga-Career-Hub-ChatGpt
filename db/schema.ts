import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// Every private entity carries an owner. No role is ever accepted from clients.
export const careerAccounts = sqliteTable("career_accounts", {
  userId: text("user_id").primaryKey(),
  profile: text("profile").notNull(),
  preferences: text("preferences").notNull(),
  notifications: text("notifications").notNull(),
  notificationRevision: integer("notification_revision").notNull().default(0),
  revision: integer("revision").notNull().default(0),
  resumeCounter: integer("resume_counter").notNull().default(0),
  activeResumeId: text("active_resume_id"),
  draft: text("draft"),
  draftRevision: integer("draft_revision").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const resumeVersions = sqliteTable("career_resume_versions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  targetRole: text("target_role").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull(),
  parentId: text("parent_id"),
  documentId: text("document_id"),
  profileRevision: integer("profile_revision").notNull(),
  metadata: text("metadata").notNull().default("{}"), archived: integer("archived").notNull().default(0),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("resume_owner_version").on(t.userId, t.version), index("resume_owner").on(t.userId)]);
export const manualJobs = sqliteTable("career_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull(),
  data: text("data").notNull(),
  source: text("source").notNull().default("manual"),
  sourceJobId: text("source_job_id"),
  lastCheckedAt: text("last_checked_at"),
  rightsConfigId: text("rights_config_id"),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("job_owner_fingerprint").on(t.userId, t.fingerprint), uniqueIndex("job_owner_source_id").on(t.userId, t.source, t.sourceJobId)]);
export const careerApplications = sqliteTable("career_applications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  jobId: text("job_id").notNull().references(() => manualJobs.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  notes: text("notes").notNull(),
  reminderAt: text("reminder_at"),
  resumeId: text("resume_id"),
  submittedAt: text("submitted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [uniqueIndex("application_owner_job").on(t.userId, t.jobId)]);
export const careerTasks = sqliteTable("career_tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: integer("completed").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
// Metadata only: never document bodies, email addresses, or tokens.
export const careerAuditEvents = sqliteTable("career_audit_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  action: text("action").notNull(),
  entityId: text("entity_id"),
  createdAt: text("created_at").notNull(),
});
export const careerRateLimits = sqliteTable("career_rate_limits", {
  userId: text("user_id").primaryKey().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  window: integer("window").notNull(),
  count: integer("count").notNull(),
});

export const careerDocuments = sqliteTable("career_documents", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  originalKey: text("original_key").notNull(), previewKey: text("preview_key"), originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(), byteSize: integer("byte_size").notNull(), sha256: text("sha256").notNull(),
  status: text("status").notNull(), extracted: text("extracted"), confirmedResumeId: text("confirmed_resume_id"), errorCode: text("error_code"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, (t) => [index("document_owner").on(t.userId)]);
export const notificationDestinations = sqliteTable("career_notification_destinations", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  channel: text("channel").notNull(), address: text("address").notNull(), verifiedAt: text("verified_at"), createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("destination_owner_channel").on(t.userId, t.channel)]);
export const destinationVerifications = sqliteTable("career_destination_verifications", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  channel: text("channel").notNull(), address: text("address").notNull(), tokenHash: text("token_hash").notNull(), expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull().default(0), consumedAt: text("consumed_at"), createdAt: text("created_at").notNull(), providerMessageId: text("provider_message_id"),
});
export const alertDispatches = sqliteTable("career_alert_dispatches", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  localDate: text("local_date").notNull(), channel: text("channel").notNull(), status: text("status").notNull(), consentRevision: integer("consent_revision").notNull(),
  profileRevision: integer("profile_revision").notNull().default(0), resumeId: text("resume_id"), resumeVersion: integer("resume_version"),
  jobIds: text("job_ids").notNull(), destinationAddress: text("destination_address").notNull(), attempts: integer("attempts").notNull().default(0),
  messagePayload: text("message_payload"),
  providerMessageId: text("provider_message_id"), errorCode: text("error_code"), leaseUntil: text("lease_until"), nextAttemptAt: text("next_attempt_at"),
  createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(), acceptedAt: text("accepted_at"), deliveredAt: text("delivered_at"),
}, (t) => [uniqueIndex("dispatch_owner_day_channel").on(t.userId, t.localDate, t.channel)]);
export const alertJobDedupe = sqliteTable("career_alert_job_dedupe", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  channel: text("channel").notNull(), jobId: text("job_id").notNull(), dispatchId: text("dispatch_id").notNull(), status: text("status").notNull(), createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("alert_job_owner_channel").on(t.userId, t.channel, t.jobId)]);
export const providerEvents = sqliteTable("career_provider_events", {
  provider: text("provider").notNull(), eventId: text("event_id").notNull(), createdAt: text("created_at").notNull(), processedAt: text("processed_at"),
}, (t) => [uniqueIndex("provider_event_identity").on(t.provider, t.eventId)]);
export const providerHealth = sqliteTable("career_provider_health", {
  provider: text("provider").primaryKey(), status: text("status").notNull(), lastCheckedAt: text("last_checked_at"), errorCode: text("error_code"),
});
export const schedulerState = sqliteTable("career_scheduler_state", {
  key: text("key").primaryKey(), cursor: text("cursor"), leaseUntil: text("lease_until"), updatedAt: text("updated_at").notNull(),
});
export const aiUsage = sqliteTable("career_ai_usage", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  day: text("day").notNull(), reservedTokens: integer("reserved_tokens").notNull(), actualTokens: integer("actual_tokens"), status: text("status").notNull(),
  expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull(), settledAt: text("settled_at"),
});
export const aiDailyUsage = sqliteTable("career_ai_daily_usage", {
  userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), day: text("day").notNull(),
  requests: integer("requests").notNull().default(0), tokensReserved: integer("tokens_reserved").notNull().default(0),
}, (t) => [uniqueIndex("ai_owner_day").on(t.userId, t.day)]);
export const aiGlobalDaily = sqliteTable("career_ai_global_daily", {
  day: text("day").primaryKey(), tokensReserved: integer("tokens_reserved").notNull().default(0),
});
export const aiLeases = sqliteTable("career_ai_leases", {
  userId: text("user_id").primaryKey().references(() => careerAccounts.userId, { onDelete: "cascade" }), usageId: text("usage_id").notNull(), expiresAt: text("expires_at").notNull(),
});
export const aiSessions = sqliteTable("career_ai_sessions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  mode: text("mode").notNull(), jobId: text("job_id"), resumeId: text("resume_id"), resumeVersion: integer("resume_version"), profileRevision: integer("profile_revision").notNull(),
  data: text("data").notNull(), revision: integer("revision").notNull().default(0), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const generatedDocuments = sqliteTable("career_generated_documents", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  kind: text("kind").notNull(), data: text("data").notNull(), profileRevision: integer("profile_revision").notNull(), resumeId: text("resume_id"), jobId: text("job_id"), createdAt: text("created_at").notNull(),
});

// All agent records are private owner-scoped. Audit/history updates are denied
// by migration triggers; deletion is reserved for approved privacy cleanup.
export const agentSettings = sqliteTable("career_agent_settings", {
  userId: text("user_id").primaryKey().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("approval"), pausedAll: integer("paused_all").notNull().default(0), pausedCategories: text("paused_categories").notNull().default("[]"),
  revision: integer("revision").notNull().default(0), vaultRevision: integer("vault_revision").notNull().default(0), answersRevision: integer("answers_revision").notNull().default(0), feedbackRevision: integer("feedback_revision").notNull().default(0),
  maxJobsPerRun: integer("max_jobs_per_run").notNull().default(10), maxPackagesPerRun: integer("max_packages_per_run").notNull().default(3),
  schedule: text("schedule").notNull().default('{"enabled":false,"timeZone":"Asia/Kolkata","runTime":"07:30"}'), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});
export const savedSearches = sqliteTable("career_saved_searches", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  label: text("label").notNull(), goal: text("goal").notNull().default(""), preferences: text("preferences").notNull(), enabled: integer("enabled").notNull().default(1),
  resumeId: text("resume_id"), status: text("status").notNull().default("active"), frequency: text("frequency").notNull().default("daily"), minExperience: integer("min_experience"), maxExperience: integer("max_experience"), mandatoryExperience: integer("mandatory_experience").notNull().default(0),
  revision: integer("revision").notNull().default(0), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("saved_search_owner").on(t.userId)]);
export const vaultFacts = sqliteTable("career_vault_facts", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), key: text("key").notNull(), label: text("label").notNull(), value: text("value"), classification: text("classification").notNull(), source: text("source").notNull(), revision: integer("revision").notNull().default(0), confirmedAt: text("confirmed_at"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("vault_owner_key").on(t.userId, t.key)]);
export const vaultHistory = sqliteTable("career_vault_history", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), key: text("key").notNull(), data: text("data").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("vault_history_owner").on(t.userId)]);
export const confirmedAnswers = sqliteTable("career_confirmed_answers", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), key: text("key").notNull(), question: text("question").notNull(), value: text("value").notNull(), revision: integer("revision").notNull().default(0), confirmedAt: text("confirmed_at").notNull(), validUntil: text("valid_until"), reconfirmAt: text("reconfirm_at"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("answer_owner_key").on(t.userId, t.key)]);
export const answerHistory = sqliteTable("career_answer_history", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), key: text("key").notNull(), data: text("data").notNull(), createdAt: text("created_at").notNull(),
});
export const agentFeedback = sqliteTable("career_agent_feedback", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), jobId: text("job_id"), reason: text("reason").notNull(), details: text("details").notNull(), createdAt: text("created_at").notNull(),
});
export const agentRuns = sqliteTable("career_agent_runs", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), idempotencyKey: text("idempotency_key").notNull(), searchId: text("search_id"), goal: text("goal").notNull(), status: text("status").notNull(), settingsRevision: integer("settings_revision").notNull(), context: text("context").notNull(), contextHash: text("context_hash").notNull(), leaseToken: text("lease_token"), leaseUntil: text("lease_until"), summary: text("summary").notNull().default(""), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("agent_run_owner_idempotency").on(t.userId, t.idempotencyKey), index("agent_run_owner").on(t.userId)]);
export const agentTasks = sqliteTable("career_agent_tasks", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), runId: text("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }), agentId: text("agent_id").notNull(), category: text("category").notNull(), taskKey: text("task_key").notNull(), status: text("status").notNull(), input: text("input").notNull(), output: text("output"), summary: text("summary").notNull().default(""), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [uniqueIndex("agent_task_owner_run_key").on(t.userId, t.runId, t.taskKey)]);
export const agentActivity = sqliteTable("career_agent_activity", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), agentId: text("agent_id").notNull(), action: text("action").notNull(), status: text("status").notNull(), summary: text("summary").notNull(), runId: text("run_id"), entityId: text("entity_id"), manifest: text("manifest").notNull(), manifestHash: text("manifest_hash").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("agent_activity_owner").on(t.userId)]);
export const applicationPackages = sqliteTable("career_application_packages", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), label: text("label").notNull(), jobId: text("job_id").notNull(), resumeId: text("resume_id"), coverId: text("cover_id"), searchId: text("search_id"), input: text("input").notNull(), status: text("status").notNull(), revision: integer("revision").notNull().default(0), snapshot: text("snapshot").notNull(), snapshotHash: text("snapshot_hash").notNull(), unknowns: text("unknowns").notNull(), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("package_owner").on(t.userId)]);
export const packageApprovals = sqliteTable("career_package_approvals", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), packageId: text("package_id").notNull().references(() => applicationPackages.id, { onDelete: "cascade" }), snapshotHash: text("snapshot_hash").notNull(), packageRevision: integer("package_revision").notNull(), settingsRevision: integer("settings_revision").notNull(), status: text("status").notNull(), expiresAt: text("expires_at").notNull(), consumedAt: text("consumed_at"), createdAt: text("created_at").notNull(),
}, t => [index("approval_owner_package").on(t.userId, t.packageId)]);
export const packageHistory = sqliteTable("career_package_history", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), packageId: text("package_id").notNull().references(() => applicationPackages.id, { onDelete: "cascade" }), revision: integer("revision").notNull(), snapshot: text("snapshot").notNull(), snapshotHash: text("snapshot_hash").notNull(), unknowns: text("unknowns").notNull(), createdAt: text("created_at").notNull(),
}, t => [uniqueIndex("package_history_owner_revision").on(t.userId, t.packageId, t.revision)]);

export const careerGoals = sqliteTable("career_goals", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  title: text("title").notNull(), targetRole: text("target_role").notNull(), description: text("description").notNull(), preferences: text("preferences").notNull(), status: text("status").notNull(), targetDate: text("target_date"), revision: integer("revision").notNull().default(0), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("goal_owner_status").on(t.userId, t.status)]);
export const recruiters = sqliteTable("career_recruiters", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), name: text("name").notNull(), company: text("company").notNull(), email: text("email").notNull(), phone: text("phone").notNull(), profileUrl: text("profile_url").notNull(), jobIds: text("job_ids").notNull(), lastInteractionAt: text("last_interaction_at"), nextFollowUpAt: text("next_follow_up_at"), notes: text("notes").notNull(), draft: text("draft").notNull(), status: text("status").notNull(), revision: integer("revision").notNull().default(0), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("recruiter_owner_followup").on(t.userId, t.nextFollowUpAt)]);
export const recruiterInteractions = sqliteTable("career_recruiter_interactions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), recruiterId: text("recruiter_id").notNull().references(() => recruiters.id, { onDelete: "cascade" }), type: text("type").notNull(), text: text("text").notNull(), occurredAt: text("occurred_at").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("interaction_owner_recruiter").on(t.userId, t.recruiterId)]);
export const interviews = sqliteTable("career_interviews", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), company: text("company").notNull(), role: text("role").notNull(), scheduledAt: text("scheduled_at").notNull(), timeZone: text("time_zone").notNull(), type: text("type").notNull(), meetingUrl: text("meeting_url").notNull(), recruiterId: text("recruiter_id").references(() => recruiters.id, { onDelete: "set null" }), jobId: text("job_id"), resumeId: text("resume_id"), notes: text("notes").notNull(), status: text("status").notNull(), source: text("source").notNull().default("manual"), revision: integer("revision").notNull().default(0), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("interview_owner_date").on(t.userId, t.scheduledAt)]);
export const learningTasks = sqliteTable("career_learning_tasks", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), goalId: text("goal_id").references(() => careerGoals.id, { onDelete: "set null" }), title: text("title").notNull(), skill: text("skill").notNull(), sourceJobIds: text("source_job_ids").notNull(), resourceUrl: text("resource_url").notNull(), dueAt: text("due_at"), notes: text("notes").notNull(), status: text("status").notNull(), revision: integer("revision").notNull().default(0), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
}, t => [index("learning_owner_status").on(t.userId, t.status)]);
export const platformHistory = sqliteTable("career_platform_history", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }), kind: text("kind").notNull(), entityId: text("entity_id").notNull(), revision: integer("revision").notNull(), action: text("action").notNull(), data: text("data").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("platform_history_owner").on(t.userId, t.createdAt)]);
