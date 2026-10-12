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
