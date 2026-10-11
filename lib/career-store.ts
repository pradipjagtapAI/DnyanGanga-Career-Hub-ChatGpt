import { CareerError, INTEGRATIONS, boolean, defaultNotifications, defaultPreferences, defaultProfile, jobFingerprint, keys, matchJob, number, object, string, validateApplication, validateJob, validateNotifications, validatePreferences, validateProfile, validateResume } from "./career-core";
import type { ManualJob, NotificationSettings, Preferences, Profile } from "./career-core";

type AccountRow = { user_id: string; profile: string; preferences: string; notifications: string; revision: number; resume_counter: number; active_resume_id: string | null; draft: string | null; draft_revision: number; created_at: string; updated_at: string };
type ResumeRow = { id: string; user_id: string; version: number; title: string; target_role: string; content: string; source: string; parent_id: string | null; profile_revision: number; created_at: string };
type JobRow = { id: string; user_id: string; data: string; created_at: string };
type ApplicationRow = { id: string; user_id: string; job_id: string; status: string; notes: string; reminder_at: string | null; resume_id: string | null; submitted_at: string | null; created_at: string; updated_at: string };
type TaskRow = { id: string; title: string; completed: number; created_at: string };
type Identity = { userId: string; email: string; fullName: string | null };

/** A fresh request-scoped store. No global visitor state or cross-user cache. */
export class CareerStore {
  db: D1Database;
  identity: Identity;
  constructor(identity: Identity, database?: D1Database) {
    if (!database) throw new CareerError(503, "DATABASE_UNAVAILABLE", "Your private workspace is temporarily unavailable. Please retry shortly.");
    this.db = database; this.identity = identity;
  }
  query(sql: string, ...values: (string | number | null)[]) { return this.db.prepare(sql).bind(...values); }
  now() { return new Date().toISOString(); }
  audit(action: string, entityId: string | null = null) {
    return this.query("INSERT INTO career_audit_events (id,user_id,action,entity_id,created_at) VALUES (?,?,?,?,?)", crypto.randomUUID(), this.identity.userId, action, entityId, this.now());
  }
  async ensureAccount() {
    const now = this.now();
    await this.query("INSERT OR IGNORE INTO career_accounts (user_id,profile,preferences,notifications,created_at,updated_at) VALUES (?,?,?,?,?,?)", this.identity.userId, JSON.stringify(defaultProfile(this.identity.email, this.identity.fullName ?? "")), JSON.stringify(defaultPreferences()), JSON.stringify(defaultNotifications()), now, now).run();
  }
  async account(): Promise<AccountRow> {
    const row = await this.query("SELECT * FROM career_accounts WHERE user_id = ?", this.identity.userId).first<AccountRow>();
    if (!row) throw new CareerError(404, "NOT_FOUND", "Your workspace was not found.");
    return row;
  }
  async rateLimit() {
    const window = Math.floor(Date.now() / 60_000);
    const row = await this.query("INSERT INTO career_rate_limits (user_id,window,count) VALUES (?,?,1) ON CONFLICT(user_id) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END, window=excluded.window RETURNING count", this.identity.userId, window).first<{ count: number }>();
    if (!row || row.count > 60) throw new CareerError(429, "RATE_LIMIT", "Too many changes. Wait one minute and try again.");
  }
  async state() {
    const account = await this.account();
    const [resumes, jobs, applications, tasks] = await Promise.all([
      this.query("SELECT * FROM career_resume_versions WHERE user_id=? ORDER BY version DESC", this.identity.userId).all<ResumeRow>(),
      this.query("SELECT * FROM career_jobs WHERE user_id=? ORDER BY created_at DESC", this.identity.userId).all<JobRow>(),
      this.query("SELECT * FROM career_applications WHERE user_id=? ORDER BY updated_at DESC", this.identity.userId).all<ApplicationRow>(),
      this.query("SELECT * FROM career_tasks WHERE user_id=? ORDER BY created_at DESC", this.identity.userId).all<TaskRow>(),
    ]);
    const profile = JSON.parse(account.profile) as Profile;
    // Account contact remains sourced from verified platform identity.
    profile.email = this.identity.email;
    const preferences = JSON.parse(account.preferences) as Preferences;
    const resumeList = resumes.results.map((row) => ({ id: row.id, version: row.version, title: row.title, targetRole: row.target_role, text: row.content, source: row.source, parentId: row.parent_id, profileRevision: row.profile_revision, createdAt: row.created_at, active: row.id === account.active_resume_id }));
    const active = resumeList.find((row) => row.active);
    const jobList = jobs.results.map((row) => {
      const data = JSON.parse(row.data) as ManualJob; const match = matchJob(data, profile, preferences, active?.text);
      match.relevance.profileRevision = account.revision; match.relevance.resumeVersion = active?.version ?? null;
      return { ...data, ...match, id: row.id, source: "manual", importedAt: row.created_at, lastCheckedAt: null, sourceNote: "User-supplied description. Vacancy, company, salary, and availability have not been verified.", matchingBasis: active ? "Confirmed profile skills present as whole terms in the active resume, profile experience, and explicit preferences. No AI interpretation is used." : "Confirmed profile skills and preferences. Select an active resume to include its confirmed skill terms." };
    }).sort((a, b) => Number(b.relevance.eligible) - Number(a.relevance.eligible) || (b.relevance.score ?? -1) - (a.relevance.score ?? -1));
    const appList = applications.results.map((row) => ({ id: row.id, jobId: row.job_id, status: row.status, notes: row.notes, reminderAt: row.reminder_at, resumeId: row.resume_id, submittedAt: row.submitted_at, createdAt: row.created_at, updatedAt: row.updated_at }));
    return { profile, preferences, resumes: resumeList, draft: account.draft ? { ...JSON.parse(account.draft), revision: account.draft_revision } : null, draftRevision: account.draft_revision, jobs: jobList, applications: appList, tasks: tasks.results.map((row) => ({ id: row.id, title: row.title, completed: row.completed === 1, createdAt: row.created_at })), notifications: JSON.parse(account.notifications) as NotificationSettings, notificationHistory: [], integrations: INTEGRATIONS, revision: account.revision, activeResumeId: account.active_resume_id, metrics: { suitableJobs: jobList.filter((j) => j.relevance.eligible).length, applicationsSubmitted: appList.filter((app) => app.submittedAt).length, completedTasks: tasks.results.filter((t) => t.completed).length, resumeUpdates: resumeList.length, practiceSessions: 0, interviewsRecorded: 0 }, account: { privateByDefault: true, sharingEnabled: false, managedIdentity: true } };
  }
  async saveProfile(value: unknown) {
    const input = object(value); keys(input, ["profile", "preferences", "expectedRevision"]);
    const before = await this.account();
    const expected = input.expectedRevision === undefined ? before.revision : number(input.expectedRevision, "Revision", Number.MAX_SAFE_INTEGER);
    const profile = validateProfile(input.profile, this.identity.email);
    const preferences = validatePreferences(input.preferences);
    const result = await this.query("UPDATE career_accounts SET profile=?, preferences=?, revision=revision+1, updated_at=? WHERE user_id=? AND revision=?", JSON.stringify(profile), JSON.stringify(preferences), this.now(), this.identity.userId, expected).run();
    if (!result.meta.changes) throw new CareerError(409, "REVISION_CONFLICT", "Your profile changed in another tab. Reload before saving.");
    await this.audit("profile.updated").run();
  }
  async saveResume(value: unknown, restored?: ResumeRow) {
    const resume = restored ? { title: `${restored.title} (restored)`.slice(0, 160), targetRole: restored.target_role, text: restored.content, source: "restored" } : validateResume(value);
    const count = await this.query("SELECT COUNT(*) AS count FROM career_resume_versions WHERE user_id=?", this.identity.userId).first<{ count: number }>();
    if ((count?.count ?? 0) >= 100) throw new CareerError(409, "QUOTA_REACHED", "The workspace supports 100 resume versions. Delete unwanted versions before saving another.");
    const id = crypto.randomUUID(); const now = this.now();
    // D1 batch is atomic: monotonic per-owner sequence and inserted version stay consistent.
    const saved = await this.db.batch([
      this.query("UPDATE career_accounts SET resume_counter=resume_counter+1, updated_at=? WHERE user_id=? AND (SELECT COUNT(*) FROM career_resume_versions WHERE user_id=?)<100", now, this.identity.userId, this.identity.userId),
      this.query("INSERT INTO career_resume_versions (id,user_id,version,title,target_role,content,source,parent_id,profile_revision,created_at) SELECT ?,user_id,resume_counter,?,?,?,?,?,revision,? FROM career_accounts WHERE user_id=? AND (SELECT COUNT(*) FROM career_resume_versions WHERE user_id=?)<100", id, resume.title, resume.targetRole, resume.text, resume.source, restored?.id ?? null, now, this.identity.userId, this.identity.userId),
      this.query("UPDATE career_accounts SET draft=NULL,draft_revision=draft_revision+1 WHERE user_id=? AND json_extract(draft,'$.text')=? AND json_extract(draft,'$.title')=? AND EXISTS(SELECT 1 FROM career_resume_versions WHERE id=? AND user_id=?)", this.identity.userId, resume.text, resume.title, id, this.identity.userId),
      this.query("INSERT INTO career_audit_events (id,user_id,action,entity_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM career_resume_versions WHERE id=? AND user_id=?)", crypto.randomUUID(), this.identity.userId, restored ? "resume.restored" : "resume.saved", id, now, id, this.identity.userId),
    ]);
    if (!saved[1].meta.changes) throw new CareerError(409, "QUOTA_REACHED", "The workspace supports 100 resume versions. Delete unwanted versions before saving another.");
    return id;
  }
  async saveDraft(value: unknown) {
    const input = object(value); keys(input, ["title", "targetRole", "text", "expectedRevision"]);
    const before = await this.account();
    const expected = input.expectedRevision === undefined ? before.draft_revision : number(input.expectedRevision, "Draft revision", Number.MAX_SAFE_INTEGER);
    const draft = { title: string(input.title, "Resume title", 160), targetRole: string(input.targetRole, "Target role", 160), text: string(input.text, "Resume text", 60000), updatedAt: this.now() };
    const result = await this.query("UPDATE career_accounts SET draft=?,draft_revision=draft_revision+1,updated_at=? WHERE user_id=? AND draft_revision=?", JSON.stringify(draft), this.now(), this.identity.userId, expected).run();
    if (!result.meta.changes) throw new CareerError(409, "DRAFT_CONFLICT", "The draft changed in another tab. Reload or save your current text as a new version.");
  }
  async deleteDraft(value: unknown) {
    keys(object(value), []);
    await this.query("UPDATE career_accounts SET draft=NULL,draft_revision=draft_revision+1 WHERE user_id=?", this.identity.userId).run();
  }
  async ownedResume(id: string) {
    const row = await this.query("SELECT * FROM career_resume_versions WHERE id=? AND user_id=?", id, this.identity.userId).first<ResumeRow>();
    if (!row) throw new CareerError(404, "NOT_FOUND", "The resume was not found.");
    return row;
  }
  async setActiveResume(id: string) {
    await this.ownedResume(id);
    await this.db.batch([
      this.query("UPDATE career_accounts SET active_resume_id=?,updated_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM career_resume_versions WHERE id=? AND user_id=?)", id, this.now(), this.identity.userId, id, this.identity.userId),
      this.audit("resume.active_selected", id),
    ]);
  }
  async deleteResume(id: string) {
    await this.ownedResume(id);
    await this.db.batch([
      this.query("UPDATE career_accounts SET active_resume_id=NULL,updated_at=? WHERE user_id=? AND active_resume_id=?", this.now(), this.identity.userId, id),
      this.query("UPDATE career_applications SET resume_id=NULL WHERE user_id=? AND resume_id=?", this.identity.userId, id),
      this.query("DELETE FROM career_resume_versions WHERE id=? AND user_id=?", id, this.identity.userId),
      this.audit("resume.deleted", id),
    ]);
  }
  async importJob(value: unknown) {
    const job = validateJob(value); const count = await this.query("SELECT COUNT(*) AS count FROM career_jobs WHERE user_id=?", this.identity.userId).first<{ count: number }>();
    if ((count?.count ?? 0) >= 500) throw new CareerError(409, "QUOTA_REACHED", "The workspace supports 500 imported jobs.");
    const id = crypto.randomUUID();
    const result = await this.query("INSERT OR IGNORE INTO career_jobs (id,user_id,fingerprint,data,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM career_jobs WHERE user_id=?)<500", id, this.identity.userId, jobFingerprint(job), JSON.stringify(job), this.now(), this.identity.userId).run();
    if (!result.meta.changes) {
      const duplicate = await this.query("SELECT id FROM career_jobs WHERE user_id=? AND fingerprint=?", this.identity.userId, jobFingerprint(job)).first();
      if (duplicate) throw new CareerError(409, "DUPLICATE_JOB", "This job title, company, location, and work arrangement are already imported.");
      throw new CareerError(409, "QUOTA_REACHED", "The workspace supports 500 imported jobs.");
    }
    await this.audit("job.imported", id).run(); return id;
  }
  async saveApplication(value: unknown, id?: string) {
    const existing = id ? await this.query("SELECT * FROM career_applications WHERE id=? AND user_id=?", id, this.identity.userId).first<ApplicationRow>() : null;
    if (id && !existing) throw new CareerError(404, "NOT_FOUND", "The application was not found.");
    const application = validateApplication(value, existing?.status);
    const jobId = existing?.job_id ?? application.jobId;
    if (existing && application.jobId && application.jobId !== existing.job_id) throw new CareerError(400, "IMMUTABLE_JOB", "An existing application cannot be moved to another job.");
    const job = await this.query("SELECT id FROM career_jobs WHERE id=? AND user_id=?", jobId, this.identity.userId).first();
    if (!job) throw new CareerError(404, "NOT_FOUND", "The job was not found.");
    const resumeId = application.resumeId ?? existing?.resume_id ?? (await this.account()).active_resume_id;
    if (resumeId) await this.ownedResume(resumeId);
    const appId = existing?.id ?? crypto.randomUUID(); const now = this.now();
    const submittedAt = existing?.submitted_at ?? (application.status === "Applied" ? now : null);
    if (existing) {
      await this.db.batch([
        this.query("UPDATE career_applications SET status=?,notes=?,reminder_at=?,resume_id=?,submitted_at=?,updated_at=? WHERE id=? AND user_id=?", application.status, application.notes, application.reminderAt, resumeId, submittedAt, now, appId, this.identity.userId),
        this.audit("application.updated", appId),
      ]);
    } else {
      const existingJobApp = await this.query("SELECT id FROM career_applications WHERE job_id=? AND user_id=?", jobId, this.identity.userId).first();
      if (existingJobApp) throw new CareerError(409, "DUPLICATE_APPLICATION", "This job is already in your tracker.");
      await this.db.batch([
        this.query("INSERT INTO career_applications (id,user_id,job_id,status,notes,reminder_at,resume_id,submitted_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM career_jobs WHERE id=? AND user_id=?)", appId, this.identity.userId, jobId, application.status, application.notes, application.reminderAt, resumeId, submittedAt, now, now, jobId, this.identity.userId),
        this.audit("application.created", appId),
      ]);
    }
    return appId;
  }
  async saveNotifications(value: unknown) {
    const account = await this.account();
    const next = validateNotifications(value, JSON.parse(account.notifications), this.now());
    const input = object(value);
    await this.db.batch([
      this.query("UPDATE career_accounts SET notifications=?,updated_at=? WHERE user_id=?", JSON.stringify(next), this.now(), this.identity.userId),
      this.audit(!next.emailConsent || !next.whatsappConsent || next.paused ? "notifications.consent_or_pause_updated" : "notifications.preferences_updated"),
      ...(input.emailConsent !== undefined ? [this.audit(next.emailConsent ? "notifications.email.opt_in" : "notifications.email.opt_out")] : []),
      ...(input.whatsappConsent !== undefined ? [this.audit(next.whatsappConsent ? "notifications.whatsapp.opt_in" : "notifications.whatsapp.opt_out")] : []),
    ]);
  }
  async createTask(value: unknown) {
    const input = object(value); keys(input, ["title"]); const title = string(input.title, "Task title", 300, true);
    const count = await this.query("SELECT COUNT(*) AS count FROM career_tasks WHERE user_id=?", this.identity.userId).first<{ count: number }>();
    if ((count?.count ?? 0) >= 500) throw new CareerError(409, "QUOTA_REACHED", "The workspace supports 500 career tasks.");
    const id = crypto.randomUUID(); const result = await this.query("INSERT INTO career_tasks (id,user_id,title,completed,created_at) SELECT ?,?,?,0,? WHERE (SELECT COUNT(*) FROM career_tasks WHERE user_id=?)<500", id, this.identity.userId, title, this.now(), this.identity.userId).run();
    if (!result.meta.changes) throw new CareerError(409, "QUOTA_REACHED", "The workspace supports 500 career tasks.");
    return id;
  }
  async updateTask(id: string, value: unknown) {
    const input = object(value); keys(input, ["completed"]); const completed = boolean(input.completed);
    const result = await this.query("UPDATE career_tasks SET completed=? WHERE id=? AND user_id=?", completed ? 1 : 0, id, this.identity.userId).run();
    if (!result.meta.changes) throw new CareerError(404, "NOT_FOUND", "The task was not found.");
  }
  async deleteJob(id: string) {
    const owned = await this.query("SELECT id FROM career_jobs WHERE id=? AND user_id=?", id, this.identity.userId).first();
    if (!owned) throw new CareerError(404, "NOT_FOUND", "The job was not found.");
    await this.db.batch([
      this.query("DELETE FROM career_applications WHERE job_id=? AND user_id=?", id, this.identity.userId),
      this.query("DELETE FROM career_jobs WHERE id=? AND user_id=?", id, this.identity.userId),
      this.audit("job.deleted", id),
    ]);
  }
  async deleteApplication(id: string) {
    const result = await this.query("DELETE FROM career_applications WHERE id=? AND user_id=?", id, this.identity.userId).run();
    if (!result.meta.changes) throw new CareerError(404, "NOT_FOUND", "The application was not found.");
    await this.audit("application.deleted", id).run();
  }
  async deleteTask(id: string) {
    const result = await this.query("DELETE FROM career_tasks WHERE id=? AND user_id=?", id, this.identity.userId).run();
    if (!result.meta.changes) throw new CareerError(404, "NOT_FOUND", "The task was not found.");
  }
  async export() {
    const state = await this.state();
    const history = await this.query("SELECT action,entity_id,created_at FROM career_audit_events WHERE user_id=? ORDER BY created_at", this.identity.userId).all();
    return { exportedAt: this.now(), schemaVersion: 1, ...state, activityHistory: history.results };
  }
  async deleteAccount(value: unknown) {
    const input = object(value); keys(input, ["confirm"]);
    if (input.confirm !== "DELETE") throw new CareerError(400, "CONFIRM_DELETE", "Type DELETE to confirm deletion of your career workspace.");
    // FK cascades apply to all owned rows. Explicit deletes are defense in depth.
    await this.db.batch([
      ...["career_applications", "career_jobs", "career_resume_versions", "career_tasks", "career_audit_events", "career_rate_limits"].map((table) => this.query(`DELETE FROM ${table} WHERE user_id=?`, this.identity.userId)),
      this.query("DELETE FROM career_accounts WHERE user_id=?", this.identity.userId),
    ]);
  }
}
