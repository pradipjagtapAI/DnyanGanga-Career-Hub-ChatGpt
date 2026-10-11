import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// Every private entity carries an owner. No role is ever accepted from clients.
export const careerAccounts = sqliteTable("career_accounts", {
  userId: text("user_id").primaryKey(),
  profile: text("profile").notNull(),
  preferences: text("preferences").notNull(),
  notifications: text("notifications").notNull(),
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
  profileRevision: integer("profile_revision").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("resume_owner_version").on(t.userId, t.version), index("resume_owner").on(t.userId)]);
export const manualJobs = sqliteTable("career_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => careerAccounts.userId, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [uniqueIndex("job_owner_fingerprint").on(t.userId, t.fingerprint)]);
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
