import { CareerError, INTEGRATIONS, boolean, defaultNotifications, defaultPreferences, defaultProfile, jobFingerprint, keys, matchJob, number, object, string, validateApplication, validateJob, validateNotifications, validatePreferences, validateProfile, validateResume } from "./career-core";
import type { ManualJob, NotificationSettings, Preferences, Profile } from "./career-core";

type AccountRow = { user_id: string; profile: string; preferences: string; notifications: string; notification_revision: number; revision: number; resume_counter: number; active_resume_id: string | null; draft: string | null; draft_revision: number; created_at: string; updated_at: string };
type ResumeRow = { id: string; user_id: string; version: number; title: string; target_role: string; content: string; source: string; parent_id: string | null; document_id: string | null; profile_revision: number; created_at: string };
type JobRow = { id: string; user_id: string; data: string; source: string; last_checked_at: string | null; created_at: string };
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
    const preferences = { ...defaultPreferences(), ...JSON.parse(account.preferences) } as Preferences;
    const resumeList = resumes.results.map((row) => ({ id: row.id, version: row.version, title: row.title, targetRole: row.target_role, text: row.content, source: row.source, parentId: row.parent_id, documentId: row.document_id, profileRevision: row.profile_revision, createdAt: row.created_at, active: row.id === account.active_resume_id }));
    const active = resumeList.find((row) => row.active);
    const jobList = jobs.results.map((row) => {
      const data = JSON.parse(row.data) as ManualJob; const match = matchJob(data, profile, preferences, active?.text);
      match.relevance.profileRevision = account.revision; match.relevance.resumeVersion = active?.version ?? null;
      const providerData = data as ManualJob & { sourceNote?: string };
      return { ...data, ...match, id: row.id, source: row.source ?? "manual", importedAt: row.created_at, lastCheckedAt: row.last_checked_at, sourceNote: providerData.sourceNote ?? (row.source === "manual" ? "User-supplied description. Vacancy, company, salary, and availability have not been verified." : "Authorized company career feed; missing fields remain unknown."), matchingBasis: active ? "Confirmed profile skills present as whole terms in the active resume, profile experience, and explicit preferences. No AI interpretation is used." : "Confirmed profile skills and preferences. Select an active resume to include its confirmed skill terms." };
    }).sort((a, b) => Number(b.relevance.eligible) - Number(a.relevance.eligible) || (b.relevance.score ?? -1) - (a.relevance.score ?? -1));
    const appList = applications.results.map((row) => ({ id: row.id, jobId: row.job_id, status: row.status, notes: row.notes, reminderAt: row.reminder_at, resumeId: row.resume_id, submittedAt: row.submitted_at, createdAt: row.created_at, updatedAt: row.updated_at }));
    const [documents, sessions, generated] = await Promise.all([
      this.query("SELECT id,original_filename,mime_type,byte_size,status,extracted,confirmed_resume_id,error_code,created_at FROM career_documents WHERE user_id=? ORDER BY created_at DESC", this.identity.userId).all(),
      this.query("SELECT * FROM career_ai_sessions WHERE user_id=? ORDER BY updated_at DESC", this.identity.userId).all(),
      this.query("SELECT * FROM career_generated_documents WHERE user_id=? ORDER BY created_at DESC", this.identity.userId).all(),
    ]);
    const aiSessions = sessions.results.map((r) => ({ id: r.id, mode: r.mode, revision: r.revision, createdAt: r.created_at, updatedAt: r.updated_at, ...JSON.parse(r.data as string) }));
    return { profile, preferences, resumes: resumeList, draft: account.draft ? { ...JSON.parse(account.draft), revision: account.draft_revision } : null, draftRevision: account.draft_revision, jobs: jobList, applications: appList, tasks: tasks.results.map((row) => ({ id: row.id, title: row.title, completed: row.completed === 1, createdAt: row.created_at })), notifications: { ...defaultNotifications(), ...JSON.parse(account.notifications) } as NotificationSettings, notificationHistory: [], documents: documents.results.map((r) => ({ id: r.id, originalFilename: r.original_filename, mimeType: r.mime_type, byteSize: r.byte_size, status: r.status, extracted: r.extracted ? JSON.parse(r.extracted as string) : null, confirmedResumeId: r.confirmed_resume_id, errorCode: r.error_code, createdAt: r.created_at })), aiSessions, generatedDocuments: generated.results.map((r) => ({ id: r.id, kind: r.kind, createdAt: r.created_at, ...JSON.parse(r.data as string) })), integrations: INTEGRATIONS, adminAccess: false, revision: account.revision, activeResumeId: account.active_resume_id, metrics: { suitableJobs: jobList.filter((j) => j.relevance.eligible).length, applicationsSubmitted: appList.filter((app) => app.submittedAt).length, completedTasks: tasks.results.filter((t) => t.completed).length, resumeUpdates: resumeList.length, practiceSessions: aiSessions.filter((s) => s.mode === "interview_feedback").length, interviewsRecorded: 0 }, account: { privateByDefault: true, sharingEnabled: false, managedIdentity: true } };
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
  async deleteResume(id: string, confirmActive=false) {
    await this.ownedResume(id);
    if((await this.account()).active_resume_id===id&&!confirmActive)throw new CareerError(409,"CONFIRM_ACTIVE_DELETE","Confirm deletion of the active resume. Matching will use your confirmed profile until another resume is selected.");
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
  async saveNotifications(value: unknown, capabilities = { email: false, whatsapp: false }) {
    const account = await this.account();
    const next = validateNotifications(value, { ...defaultNotifications(), ...JSON.parse(account.notifications) }, this.now(), capabilities);
    const input = object(value);
    await this.db.batch([
      this.query("UPDATE career_accounts SET notifications=?,notification_revision=notification_revision+1,updated_at=? WHERE user_id=?", JSON.stringify(next), this.now(), this.identity.userId),
      this.query("UPDATE career_alert_dispatches SET status='cancelled',updated_at=? WHERE user_id=? AND status IN ('queued','retry')", this.now(), this.identity.userId),
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
    const [destinations, dispatches, receipts, usage] = await Promise.all(["career_notification_destinations", "career_alert_dispatches", "career_alert_job_dedupe", "career_ai_usage"].map((table) => this.query(`SELECT * FROM ${table} WHERE user_id=?`, this.identity.userId).all()));
    return { exportedAt: this.now(), schemaVersion: 2, ...state, activityHistory: history.results, notificationDestinations: destinations.results, notificationHistory: dispatches.results, notificationJobReceipts: receipts.results, aiUsage: usage.results };
  }
  async ownedJob(id: string) {
    const row = await this.query("SELECT * FROM career_jobs WHERE id=? AND user_id=?", id, this.identity.userId).first<JobRow>();
    if (!row) throw new CareerError(404, "NOT_FOUND", "The job was not found.");
    return { ...JSON.parse(row.data), id:row.id, source:row.source ?? "manual" } as ManualJob & { id: string; aiAllowed?: boolean; source?: string };
  }
  aiBudget() {
    return {
      reserve: async (input: { id: string; day: string; reservedTokens: number; maxDailyRequests: number; maxDailyTokens: number; maxGlobalDailyTokens: number; expiresAt: string }) => {
        const now = this.now(); const owner = this.identity.userId;
        if (input.day !== now.slice(0, 10) || !/^[a-zA-Z0-9-]{1,80}$/.test(input.id) || Date.parse(input.expiresAt) <= Date.parse(now) || Date.parse(input.expiresAt) > Date.parse(now) + 300_000 || ![input.reservedTokens, input.maxDailyRequests, input.maxDailyTokens, input.maxGlobalDailyTokens].every((v) => Number.isSafeInteger(v) && v > 0 && v <= 1_000_000_000)) throw new CareerError(503, "AI_BUDGET_CONFIG", "AI usage limits are invalid.");
        await this.db.batch([
          this.query("INSERT OR IGNORE INTO career_ai_daily_usage(user_id,day,requests,tokens_reserved) VALUES(?,?,0,0)", owner, input.day),
          this.query("INSERT OR IGNORE INTO career_ai_global_daily(day,tokens_reserved) VALUES(?,0)", input.day),
        ]);
        // Conditional statements share one D1 transaction. changes() propagates the
        // accepted global guard; blocked requests cannot consume a partial quota.
        const results = await this.db.batch([
          this.query("UPDATE career_ai_global_daily SET tokens_reserved=tokens_reserved+? WHERE day=? AND tokens_reserved+?<=? AND EXISTS(SELECT 1 FROM career_ai_daily_usage WHERE user_id=? AND day=? AND requests<? AND tokens_reserved+?<=?) AND NOT EXISTS(SELECT 1 FROM career_ai_leases WHERE user_id=? AND expires_at>?) AND NOT EXISTS(SELECT 1 FROM career_ai_usage WHERE id=?)", input.reservedTokens, input.day, input.reservedTokens, input.maxGlobalDailyTokens, owner, input.day, input.maxDailyRequests, input.reservedTokens, input.maxDailyTokens, owner, now, input.id),
          this.query("UPDATE career_ai_daily_usage SET requests=requests+1,tokens_reserved=tokens_reserved+? WHERE user_id=? AND day=? AND changes()>0", input.reservedTokens, owner, input.day),
          this.query("INSERT INTO career_ai_usage(id,user_id,day,reserved_tokens,status,expires_at,created_at) SELECT ?,?,?,?,'reserved',?,? WHERE changes()>0", input.id, owner, input.day, input.reservedTokens, input.expiresAt, now),
          this.query("INSERT INTO career_ai_leases(user_id,usage_id,expires_at) SELECT ?,?,? WHERE changes()>0 ON CONFLICT(user_id) DO UPDATE SET usage_id=excluded.usage_id,expires_at=excluded.expires_at", owner, input.id, input.expiresAt),
        ]);
        if (!results[2].meta.changes) throw new CareerError(429, "AI_USAGE_LIMIT", "AI usage is at its limit or another request is running. Try later.");
      },
      settle: async (id: string, outcome: "success" | "provider_failure" | "invalid_output" | "timeout", actualTokens: number | null) => {
        if (!["success", "provider_failure", "invalid_output", "timeout"].includes(outcome) || (actualTokens !== null && (!Number.isSafeInteger(actualTokens) || actualTokens < 0 || actualTokens>1_000_000_000))) throw new CareerError(400, "INVALID_AI_USAGE", "Invalid AI usage result.");
        await this.db.batch([
          this.query("UPDATE career_ai_usage SET status=CASE WHEN ?>reserved_tokens THEN 'invalid_output' ELSE ? END,actual_tokens=?,settled_at=? WHERE id=? AND user_id=? AND status='reserved'", actualTokens, outcome, actualTokens, this.now(), id, this.identity.userId),
          this.query("DELETE FROM career_ai_leases WHERE user_id=? AND usage_id=?", this.identity.userId, id),
        ]);
      },
    };
  }
  async ownedAISession(id: string) {
    const row = await this.query("SELECT * FROM career_ai_sessions WHERE id=? AND user_id=?", id, this.identity.userId).first<{id:string;mode:string;data:string;revision:number}>();
    if (!row) throw new CareerError(404, "NOT_FOUND", "The practice or coaching session was not found.");
    return { ...row, data: JSON.parse(row.data) };
  }
  async saveAISession(result: {mode:string;reply:string;context:{jobId:string|null;resumeId:string|null;resumeVersion:number|null;profileRevision:number}}, prompt: string, id?: string, expectedRevision?: number) {
    const now = this.now(); const sessionId = id ?? crypto.randomUUID();
    const existing = id ? await this.ownedAISession(id) : null;
    const interviewPair = ["interview_questions", "interview_feedback"].includes(existing?.mode ?? "") && ["interview_questions", "interview_feedback"].includes(result.mode);
    if (existing && existing.mode !== result.mode && !interviewPair) throw new CareerError(400, "SESSION_MODE", "Use a separate session for this tool.");
    if (existing && JSON.stringify(existing.data.result.context) !== JSON.stringify(result.context)) throw new CareerError(409, "SESSION_CONTEXT_CHANGED", "Your profile, active resume, or selected job changed. Start a new session for current context.");
    const history = [...(existing?.data.history ?? []), ...(prompt ? [{role:"user",text:prompt}] : []), {role:"assistant",text:result.reply}].slice(-12);
    const data = JSON.stringify({ result, history });
    const response = existing ? await this.query("UPDATE career_ai_sessions SET mode=?,data=?,revision=revision+1,updated_at=? WHERE id=? AND user_id=? AND revision=?", result.mode, data, now, sessionId, this.identity.userId, expectedRevision ?? existing.revision).run() : await this.query("INSERT INTO career_ai_sessions(id,user_id,mode,job_id,resume_id,resume_version,profile_revision,data,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM career_ai_sessions WHERE user_id=?)<200", sessionId, this.identity.userId, result.mode, result.context.jobId, result.context.resumeId, result.context.resumeVersion, result.context.profileRevision, data, now, now, this.identity.userId).run();
    if (!response.meta.changes) throw new CareerError(409, "SESSION_CONFLICT", "Session changed or the session limit was reached. Reload before saving.");
    return sessionId;
  }
  async deleteAISession(id: string) {
    const result = await this.query("DELETE FROM career_ai_sessions WHERE id=? AND user_id=?", id, this.identity.userId).run();
    if (!result.meta.changes) throw new CareerError(404, "NOT_FOUND", "The session was not found.");
    await this.audit("ai.session_deleted", id).run();
  }
  async reviewAISession(id: string, value: unknown) {
    const input = object(value); keys(input, ["confirmed", "kind", "title", "targetRole"]);
    if (input.confirmed !== true || !["resume", "coverletter"].includes(input.kind as string)) throw new CareerError(400, "REVIEW_REQUIRED", "Review and confirm the generated document before saving it.");
    const session = await this.ownedAISession(id); const result = session.data.result;
    if (result.mode !== input.kind || !result.documentText) throw new CareerError(400, "DOCUMENT_UNAVAILABLE", "This session does not contain that document type.");
    const title = string(input.title ?? "Reviewed career draft", "Title", 160, true);
    if (input.kind === "resume") return this.saveTrustedResume({title, targetRole:string(input.targetRole, "Target role",160), text:string(result.documentText,"Resume text",60000,true), source:result.source === "ai" ? "ai-assisted-reviewed" : "self-review", profileRevision:result.context.profileRevision}, null);
    const generatedId = crypto.randomUUID();
    const inserted = await this.query("INSERT INTO career_generated_documents(id,user_id,kind,data,profile_revision,resume_id,job_id,created_at) SELECT ?,?,'coverletter',?,?,?,?,? WHERE (SELECT COUNT(*) FROM career_generated_documents WHERE user_id=?)<100", generatedId, this.identity.userId, JSON.stringify({title,text:result.documentText,source:result.source,sessionId:id,context:result.context}), result.context.profileRevision, result.context.resumeId, result.context.jobId, this.now(), this.identity.userId).run();
    if (!inserted.meta.changes) throw new CareerError(409,"QUOTA_REACHED","Delete unwanted generated documents before saving another.");
    return generatedId;
  }
  async saveTrustedResume(resume: {title:string;targetRole:string;text:string;source:string;profileRevision:number}, documentId: string | null, profile?: Profile, expectedRevision?: number) {
    const id = crypto.randomUUID(); const now = this.now(); const account = await this.account();
    const expected = expectedRevision ?? account.revision;
    const statements = [
      this.query("INSERT INTO career_resume_versions(id,user_id,version,title,target_role,content,source,document_id,profile_revision,created_at) SELECT ?,user_id,resume_counter+1,?,?,?,?,?,?,? FROM career_accounts WHERE user_id=? AND revision=? AND (SELECT COUNT(*) FROM career_resume_versions WHERE user_id=?)<100 AND (? IS NULL OR EXISTS(SELECT 1 FROM career_documents WHERE id=? AND user_id=? AND status IN ('review_required','confirmed')))",id,resume.title,resume.targetRole,resume.text,resume.source,documentId,resume.profileRevision,now,this.identity.userId,expected,this.identity.userId,documentId,documentId,this.identity.userId),
      this.query("UPDATE career_accounts SET resume_counter=resume_counter+1,profile=COALESCE(?,profile),revision=revision+?,updated_at=? WHERE user_id=? AND EXISTS(SELECT 1 FROM career_resume_versions WHERE id=? AND user_id=?)",profile ? JSON.stringify(profile) : null,profile ? 1 : 0,now,this.identity.userId,id,this.identity.userId),
    ];
    if (documentId) statements.push(this.query("UPDATE career_documents SET status='confirmed',confirmed_resume_id=?,updated_at=? WHERE id=? AND user_id=? AND EXISTS(SELECT 1 FROM career_resume_versions WHERE id=? AND user_id=?)",id,now,documentId,this.identity.userId,id,this.identity.userId));
    statements.push(this.query("INSERT INTO career_audit_events(id,user_id,action,entity_id,created_at) SELECT ?,?,'resume.reviewed_saved',?,? WHERE EXISTS(SELECT 1 FROM career_resume_versions WHERE id=? AND user_id=?)",crypto.randomUUID(),this.identity.userId,id,now,id,this.identity.userId));
    const results = await this.db.batch(statements);
    if (!results[0].meta.changes) throw new CareerError(409,"REVISION_CONFLICT","Profile changed or the resume version limit was reached. Reload before confirming.");
    return id;
  }
  async deleteAccount(value: unknown, bucket?: R2Bucket) {
    const input = object(value); keys(input, ["confirm"]);
    if (input.confirm !== "DELETE") throw new CareerError(400, "CONFIRM_DELETE", "Type DELETE to confirm deletion of your career workspace.");
    const files=await this.query("SELECT original_key,preview_key FROM career_documents WHERE user_id=?",this.identity.userId).all<{original_key:string;preview_key:string|null}>();
    if(files.results.length&&!bucket)throw new CareerError(503,"STORAGE_UNAVAILABLE","Private file deletion cannot be confirmed until storage is available.");
    if(bucket&&files.results.length)await bucket.delete(files.results.flatMap(row=>[row.original_key,...(row.preview_key?[row.preview_key]:[])]));
    // FK cascades apply to all owned rows. Explicit deletes are defense in depth.
    await this.db.batch([
      ...["career_applications", "career_jobs", "career_resume_versions", "career_documents", "career_tasks", "career_audit_events", "career_rate_limits", "career_notification_destinations", "career_destination_verifications", "career_alert_job_dedupe", "career_alert_dispatches", "career_ai_usage", "career_ai_daily_usage", "career_ai_leases", "career_ai_sessions", "career_generated_documents"].map((table) => this.query(`DELETE FROM ${table} WHERE user_id=?`, this.identity.userId)),
      this.query("DELETE FROM career_accounts WHERE user_id=?", this.identity.userId),
    ]);
  }
}
