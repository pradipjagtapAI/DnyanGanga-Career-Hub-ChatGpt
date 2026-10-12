/** Server-only bounded coordination. Specialist names describe logical executors,
 * not twenty-one autonomous provider connections. Every result has a durable task. */
import { CareerError, defaultPreferences, keys, object, string } from "./career-core";
import type { ManualJob, Preferences, Profile } from "./career-core";
import { CareerStore } from "./career-store";
import { CareerAgentStore } from "./career-agent-store";
import { SPECIALIST_AGENTS, assertAgentAllowed, jobScreeningKey, snapshotHash } from "./career-agent-contract";
import type { AgentCategory, AgentRun, AgentTask, AgentTaskStatus, SavedSearch, VaultFact } from "./career-agent-contract";
import { aiAvailability, buildAIContext, generateCareerAI, selfReviewCareer } from "./career-ai";
import type { CareerAIEnv, CareerAIMode, CareerAIProvider } from "./career-ai";
import { approvedGreenhouseBoards, fetchGreenhouseJobs, getProviderIntegrationState, persistOwnedFeedResults } from "./career-providers";
import type { CareerProviderEnv, FeedResult, Fetcher } from "./career-providers";
import { rankAgentJob } from "./career-agent-matching";
import { analyzeResumeFacts, buildLearningPlan, buildNetworkingDrafts, resolveAgentModel } from "./career-intelligence";
import type { AgentModelEnv } from "./career-intelligence";

export type CareerAgentEnv = CareerProviderEnv & CareerAIEnv & AgentModelEnv;
export type AgentDependencies = { now?: () => Date; monotonicNow?: () => number; fetcher?: Fetcher; aiProvider?: CareerAIProvider; discover?: (env: CareerProviderEnv, fetcher: Fetcher, now: Date) => Promise<FeedResult[]>; maxDurationMs?: number; externalCallBudget?: 0 | 1 };
type OwnedJob = ManualJob & { id: string; source?: string; aiAllowed?: boolean; lastCheckedAt?: string | null; sourceBoard?: string; rightsConfigId?: string };
type Outcome = { status: AgentTaskStatus; summary: string; output: Record<string, unknown> };
const finished = (task: AgentTask) => !["queued", "running"].includes(task.status);
const clock = (deps: AgentDependencies) => deps.now?.() ?? new Date();
const monotonic = (deps: AgentDependencies) => deps.monotonicNow?.() ?? Date.now();
const q = (db: D1Database, sql: string, ...args: (string | number | null)[]) => db.prepare(sql).bind(...args);

/** Missing settings preserve existing accounts. The database is consulted on every call. */
export async function currentAgentPause(db: D1Database, userId: string) {
  const row = await q(db, "SELECT paused_all,paused_categories,revision FROM career_agent_settings WHERE user_id=?", userId).first<{ paused_all: number; paused_categories: string; revision: number }>();
  return { pausedAll: row?.paused_all === 1, pausedCategories: row ? JSON.parse(row.paused_categories) as AgentCategory[] : [], revision: row?.revision ?? 0 };
}
function scheduleParts(now: Date, timeZone: string) {
  if (!Number.isFinite(now.getTime())) throw new CareerError(400, "INVALID_SCHEDULE", "Use a valid schedule date.");
  let parts: Intl.DateTimeFormatPart[];
  try { parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now); }
  catch { throw new CareerError(400, "INVALID_SCHEDULE", "Choose a supported IANA time zone."); }
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? "";
  return { localDate: `${get("year")}-${get("month")}-${get("day")}`, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}
function scheduleMinute(runTime: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(runTime)) throw new CareerError(400, "INVALID_SCHEDULE", "Choose a schedule time in 24-hour HH:mm format.");
  return Number(runTime.slice(0, 2)) * 60 + Number(runTime.slice(3));
}
const localMinuteSerial = (parts: { localDate: string; minute: number }) => Date.parse(`${parts.localDate}T00:00:00Z`) + parts.minute * 60000;
function skippedScheduleAt(current: ReturnType<typeof scheduleParts>, previous: ReturnType<typeof scheduleParts>, target: number) {
  const selected = Date.parse(`${current.localDate}T00:00:00Z`) + target * 60000;
  return localMinuteSerial(current) - localMinuteSerial(previous) > 60000 && localMinuteSerial(previous) < selected && localMinuteSerial(current) > selected;
}
export function agentScheduleDue(now: Date, timeZone: string, runTime = "07:30") {
  const parts = scheduleParts(now, timeZone), target = scheduleMinute(runTime);
  const elapsed = (parts.minute - target + 1440) % 1440;
  const localDate = parts.minute < target && elapsed < 60 ? new Date(Date.parse(`${parts.localDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : parts.localDate;
  if (elapsed < 60) return { localDate, due: true };
  // A nonexistent spring-forward time starts its full catch-up window at the
  // first available local minute, including the start of the skipped hour.
  const earlier = scheduleParts(new Date(now.getTime() - 60 * 60000), timeZone);
  if (localMinuteSerial(parts) - localMinuteSerial(earlier) > 60 * 60000) {
    const minute = Math.floor(now.getTime() / 60000) * 60000;
    for (let i = 0; i < 60; i++) {
      const candidate = new Date(minute - i * 60000), current = scheduleParts(candidate, timeZone), previous = scheduleParts(new Date(candidate.getTime() - 60000), timeZone);
      if (skippedScheduleAt(current, previous, target)) return { localDate: current.localDate, due: true };
    }
  }
  return { localDate, due: false };
}
export function nextAgentRunAt(now: Date, timeZone: string, runTime = "07:30") {
  const target = scheduleMinute(runTime); scheduleParts(now, timeZone);
  const start = Math.floor(now.getTime() / 60000) * 60000 + 60000;
  for (let i = 0; i < 4320; i++) {
    const candidate = new Date(start + i * 60000), p = scheduleParts(candidate, timeZone), previous = scheduleParts(new Date(candidate.getTime() - 60000), timeZone);
    // A spring-forward missing time uses the first available minute within the
    // catch-up window. Fall-back repeats share one local-date run key.
    if (p.minute === target || skippedScheduleAt(p, previous, target)) return candidate.toISOString();
  }
  return null;
}
function schedulerConfigured(env: CareerAgentEnv) { return !!env.CAREER_SCHEDULER_SECRET && env.CAREER_SCHEDULER_SECRET.length >= 32; }
export async function getCareerAgentState(store: CareerAgentStore, env: CareerAgentEnv = {}) {
  const state = await store.commandState(); const configured = schedulerConfigured(env);
  const health = await q(store.db, "SELECT status,last_checked_at,error_code FROM career_provider_health WHERE provider='agents_scheduler'").first<{ status: string; last_checked_at: string | null; error_code: string | null }>();
  const observed = !!health?.last_checked_at && Date.now() - Date.parse(health.last_checked_at) < 300000 && Date.parse(health.last_checked_at) <= Date.now() + 60000;
  const paused = state.settings.pausedAll;
  state.settings.schedule = { ...state.settings.schedule, configured, nextRunAt: configured && observed && state.settings.schedule.enabled && !paused ? nextAgentRunAt(new Date(), state.settings.schedule.timeZone, state.settings.schedule.runTime) : null, status: !configured ? "setup_required" : paused ? "paused" : !state.settings.schedule.enabled ? "disabled" : !observed ? "awaiting_worker" : health?.status === "degraded" ? "degraded" : "active", reason: !configured ? "Deploy the authenticated external scheduler and configure its server credentials before unattended runs." : !observed ? "Credentials are configured, but a recent scheduler invocation has not been observed. Confirm the external worker deployment." : `Scheduler last observed ${health?.last_checked_at}. Local tasks can run without live AI or job providers; provider failures remain separate.` };
  const sources = approvedGreenhouseBoards(env).length > 0;
  for (const agent of state.agents) {
    if (agent.id === "application_execution") { agent.status = "unsupported"; agent.reason = "No supported submission integration exists. Packages and original links are available; nothing is submitted automatically."; }
    else if (agent.id === "job_discovery" && !sources && !agent.completedTasks) { agent.status = "blocked"; agent.reason = "Approved employer boards are not configured. Independently imported job descriptions remain available."; }
    else if (["resume_tailoring", "cover_letter", "interview_preparation", "career_coach"].includes(agent.id) && aiAvailability(resolveAgentModel(agent.id, env).env).status !== "configured" && !agent.completedTasks) { agent.reason = "Local self-review is available; live AI awaits an approved task model route, credentials and usage budgets."; }
    else if (["follow_up", "networking"].includes(agent.id)) agent.reason = "Drafts only. Employer message sending is unsupported and requires separate consent and integration.";
    const supported = !["blocked", "unsupported"].includes(agent.status) && agent.id !== "application_execution" && !(agent.id === "job_discovery" && !sources);
    // Notification dispatch has its own channel schedule and readiness gates.
    // This coordinator state has no reliably verified next channel dispatch, so
    // it must not reuse the 07:30 discovery time as a promised notification time.
    agent.nextRunAt = agent.id !== "notification" && supported && !paused && !state.settings.pausedCategories.includes(agent.category) ? state.settings.schedule.nextRunAt : null;
  }
  return state;
}

/** A search may narrow an explicit mandatory preference, never widen it. */
export function matchSavedSearch(job: ManualJob, profile: Profile, global: Preferences, search: SavedSearch | null, text?: string, verifiedFacts?: VaultFact[]) {
  const baseline = rankAgentJob(job, profile, global, text, verifiedFacts);
  if (!search) return baseline;
  // Empty search choices inherit the explicit global choices. This avoids an
  // implicit current-city fallback conflicting with a chosen global location.
  const searchPrefs = { ...search.preferences, preferredCities: search.preferences.preferredCities.length ? search.preferences.preferredCities : global.preferredCities, preferredCountries: search.preferences.preferredCountries?.length ? search.preferences.preferredCountries : global.preferredCountries, targetRoles: search.preferences.targetRoles.length ? search.preferences.targetRoles : global.targetRoles, industries: search.preferences.industries.length ? search.preferences.industries : global.industries, workArrangements: search.preferences.workArrangements.length ? search.preferences.workArrangements : global.workArrangements, employmentTypes: search.preferences.employmentTypes.length ? search.preferences.employmentTypes : global.employmentTypes };
  const scoped = rankAgentJob(job, profile, searchPrefs, text, verifiedFacts);
  const reasons = [...new Set([...baseline.relevance.excludedReasons, ...scoped.relevance.excludedReasons])];
  if (search.mandatoryExperience) {
    if (search.minExperience != null && (job.minExperience == null || job.minExperience < search.minExperience)) reasons.push(job.minExperience == null ? "Mandatory campaign minimum experience is unknown" : "Below campaign minimum required experience");
    if (search.maxExperience != null && (job.maxExperience == null || job.maxExperience > search.maxExperience)) reasons.push(job.maxExperience == null ? "Mandatory campaign maximum experience is unknown" : "Above campaign maximum required experience");
  }
  const eligible = baseline.relevance.eligible && scoped.relevance.eligible && reasons.length === 0;
  return { ...scoped, opportunityPriority: eligible ? scoped.opportunityPriority : { ...scoped.opportunityPriority, level: "Low" as const, eligible: false, points: 0, reasons: ["Excluded by global or saved-search mandatory preferences."] }, relevance: { ...scoped.relevance, eligible, excludedReasons: reasons, score: eligible ? scoped.relevance.score : null, label: eligible ? scoped.relevance.label : "Excluded by global or saved-search preferences", method: scoped.relevance.method + " Saved-search eligibility is intersected with current global mandatory filters." } };
}
export function canonicalJobDestination(value: string) {
  if (!value) return null;
  try { const url = new URL(value); url.hash = ""; for (const key of [...url.searchParams.keys()]) if (/^utm_(source|medium|campaign|term|content|id|source_platform|creative_format|marketing_tactic)$/i.test(key)) url.searchParams.delete(key); url.searchParams.sort(); return url.toString(); } catch { return null; }
}
export function verifyOwnedJobs(jobs: OwnedJob[]) {
  const groups = new Map<string, OwnedJob[]>();
  for (const job of jobs) { const key = canonicalJobDestination(job.url) ?? `owned-id:${job.id}`; groups.set(key, [...(groups.get(key) ?? []), job]); }
  const primary = new Map<string, string>();
  for (const group of groups.values()) {
    group.sort((a, b) => Number(b.source === "greenhouse") - Number(a.source === "greenhouse") || (Date.parse(b.lastCheckedAt ?? "") || 0) - (Date.parse(a.lastCheckedAt ?? "") || 0));
    for (const job of group) primary.set(job.id, group[0].id);
  }
  return jobs.map(job => {
    const text = `${job.description}\n${job.salary}`; const warnings: string[] = [];
    if (/(?:application|registration|interview|recruitment|job)[\s\S]{0,50}(?:fee|payment|deposit)|(?:pay|payment|deposit)[\s\S]{0,50}(?:apply|application|registration|interview)/i.test(text)) warnings.push("This description mentions application/recruitment payment. Independently verify any request before paying; this is a review indicator, not a fraud determination.");
    if (/bank(?:ing)?\s+(?:password|passcode|pin)|net\s*banking\s+(?:password|passcode|pin)/i.test(text)) warnings.push("This description mentions banking credentials. Do not disclose banking passwords or payment passcodes to an employer.");
    if (/\b(?:otp|one[- ]time (?:password|passcode|code))\b/i.test(text)) warnings.push("This description mentions an OTP or one-time code. Review the context; do not share authentication or payment codes.");
    const missing = [job.location == null && "location", job.workArrangement == null && "work_arrangement", job.employmentType == null && "employment_type", job.minExperience == null && job.maxExperience == null && "required_experience", !job.requirements.length && "structured_requirements", job.salaryMin == null && job.salaryMax == null && "salary", !job.url && "original_application_url"].filter(Boolean);
    return { id: job.id, primaryJobId: primary.get(job.id)!, duplicateOf: primary.get(job.id) === job.id ? null : primary.get(job.id)!, source: job.source, url: job.url, canonicalUrl: canonicalJobDestination(job.url), lastCheckedAt: job.lastCheckedAt ?? null, status: job.closed ? "closed" : job.source === "manual" ? "user_imported_unverified" : "source_snapshot", missing, warnings, availabilityVerified: false, availabilityEvidence: job.source === "greenhouse" && job.lastCheckedAt ? `Source snapshot last checked ${job.lastCheckedAt}; this local review does not make a new live availability check.` : "Availability has not been independently checked." };
  });
}
export function applyOwnedJobFeedback<T extends ReturnType<typeof matchSavedSearch>>(match: T, jobId: string, feedback: { jobId: string | null; reason: string; details: string; createdAt: string }[]) {
  const latest = feedback.filter(f => f.jobId === jobId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const adjustment = latest ? -10 : 0;
  return { ...match, rankingScore: match.relevance.eligible ? Math.max(0, (match.relevance.score ?? 0) + adjustment) : null, memoryAdjustment: { points: adjustment, reason: latest ? `This exact listing has candidate feedback (${latest.reason}). Its queue priority is reduced by 10 points; the nine-factor evidence score and mandatory filters are unchanged.` : "No job-specific candidate feedback adjustment.", feedback: latest ? { reason: latest.reason, details: latest.details, createdAt: latest.createdAt } : null } };
}
function selectedJobs(jobs: OwnedJob[], profile: Profile, preferences: Preferences, search: SavedSearch | null, text: string | undefined, max: number, vault: VaultFact[], feedback: { jobId: string | null; reason: string; details: string; createdAt: string }[]) {
  const verification = verifyOwnedJobs(jobs); const primary = new Set(verification.filter(v => !v.duplicateOf).map(v => v.id));
  return jobs.filter(job => primary.has(job.id)).map(job => ({ job, match: applyOwnedJobFeedback(matchSavedSearch(job, profile, preferences, search, text, vault), job.id, feedback) })).filter(row => row.match.relevance.eligible).sort((a, b) => (b.match.rankingScore ?? 0) - (a.match.rankingScore ?? 0)).slice(0, max);
}
async function ownedRecruiterContacts(store: CareerAgentStore) {
  const rows = await q(store.db, "SELECT id,name,company,email,notes,last_interaction_at,next_follow_up_at FROM career_recruiters WHERE user_id=? AND status<>'archived' ORDER BY updated_at DESC LIMIT 100", store.owner).all<{ id: string; name: string; company: string; email: string; notes: string; last_interaction_at: string | null; next_follow_up_at: string | null }>();
  return rows.results.map(row => ({ id: row.id, name: row.name, company: row.company, email: row.email, notes: row.notes, lastInteractionAt: row.last_interaction_at, nextFollowUpAt: row.next_follow_up_at }));
}
async function ownedUsageReport(store: CareerAgentStore, env: CareerAgentEnv, now: Date) {
  const day = now.toISOString().slice(0, 10), month = day.slice(0, 7);
  const [ai, messages, documents, providerRequests, tasks] = await Promise.all([
    q(store.db, "SELECT day,status,reserved_tokens,actual_tokens FROM career_ai_usage WHERE user_id=? AND day>=?", store.owner, `${month}-01`).all<{ day: string; status: string; reserved_tokens: number; actual_tokens: number | null }>(),
    q(store.db, "SELECT channel,status,attempts FROM career_alert_dispatches WHERE user_id=? AND created_at>=?", store.owner, `${month}-01T00:00:00Z`).all<{ channel: string; status: string; attempts: number }>(),
    q(store.db, "SELECT COUNT(*) count,COALESCE(SUM(byte_size),0) original_bytes FROM career_documents WHERE user_id=?", store.owner).first<{ count: number; original_bytes: number }>(),
    q(store.db, "SELECT COUNT(*) count FROM career_agent_activity WHERE user_id=? AND agent_id='job_discovery' AND action='before-request' AND created_at>=?", store.owner, `${month}-01T00:00:00Z`).first<{ count: number }>(),
    q(store.db, "SELECT status,COUNT(*) count FROM career_agent_tasks WHERE user_id=? AND created_at>=? GROUP BY status", store.owner, `${month}-01T00:00:00Z`).all<{ status: string; count: number }>(),
  ]);
  const measure = (rows: typeof ai.results) => ({ reservations: rows.length, reservedTokens: rows.reduce((sum, r) => sum + r.reserved_tokens, 0), knownActualTokens: rows.reduce((sum, r) => sum + (r.actual_tokens ?? 0), 0), unknownActualRequests: rows.filter(r => r.actual_tokens === null).length, outcomes: Object.fromEntries([...new Set(rows.map(r => r.status))].map(status => [status, rows.filter(r => r.status === status).length])) });
  return { asOf: now.toISOString(), period: { day, month, timeZone: "UTC", reason: "AI quota periods use UTC server dates." }, ai: { day: measure(ai.results.filter(r => r.day === day)), month: measure(ai.results), limits: { dailyRequests: env.AI_DAILY_REQUEST_LIMIT ? Number(env.AI_DAILY_REQUEST_LIMIT) : null, dailyReservedTokens: env.AI_DAILY_TOKEN_LIMIT ? Number(env.AI_DAILY_TOKEN_LIMIT) : null, globalDailyReservedTokens: env.AI_GLOBAL_DAILY_TOKEN_LIMIT ? Number(env.AI_GLOBAL_DAILY_TOKEN_LIMIT) : null }, monetaryCost: null, costReason: "Only total tokens are recorded; model-specific input/output token rates and provider invoices are required for a reliable monetary cost. Quota reservations are not confirmed provider requests." }, messages: ["email", "whatsapp"].map(channel => ({ channel, dispatchRecords: messages.results.filter(r => r.channel === channel).length, attempts: messages.results.filter(r => r.channel === channel).reduce((sum, r) => sum + r.attempts, 0), accepted: messages.results.filter(r => r.channel === channel && ["accepted", "delivered"].includes(r.status)).length, delivered: messages.results.filter(r => r.channel === channel && r.status === "delivered").length })), documentMetadata: { count: documents?.count ?? 0, originalBytes: documents?.original_bytes ?? 0, actualR2BilledStorage: null }, sourceRequestManifests: providerRequests?.count ?? 0, tasks: tasks.results, unmeasured: ["Conversion/OCR provider billing", "Job-source licence fees", "Full R2 object/backups storage", "Email/WhatsApp invoiced costs", "Worker CPU/database usage", "Per-plan monetary limits"], controls: ["Existing transactional daily user/global AI request/token quotas and one live call per invocation remain enforced.", "Only recorded owned rows are reported; provider acceptance and delivery are counted separately.", "No billing, refund or plan entitlement is changed by this review."] };
}
async function plan(store: CareerAgentStore, run: AgentRun, env: CareerAgentEnv) {
  for (const agent of SPECIALIST_AGENTS) {
    const boards = agent.id === "job_discovery" ? approvedGreenhouseBoards(env) : [];
    if (boards.length) for (const board of boards) await store.addTask(run.id, { agentId: agent.id, category: agent.category, taskKey: `${agent.id}:${board.board}`, input: { goal: run.goal, searchId: run.searchId, context: run.context, board: board.board } });
    else await store.addTask(run.id, { agentId: agent.id, category: agent.category, taskKey: agent.id, input: { goal: run.goal, searchId: run.searchId, context: run.context } });
  }
}
export async function startCareerAgentRun(store: CareerAgentStore, value: unknown, env: CareerAgentEnv = {}, deps: AgentDependencies = {}) {
  const started = monotonic(deps); const duration = Math.max(1000, Math.min(18000, deps.maxDurationMs ?? 18000));
  const input = object(value); keys(input, ["goal", "searchId", "searchIds", "idempotencyKey"]);
  // Browser nonces never widen permissions or replace the server context key.
  if (input.idempotencyKey !== undefined) string(input.idempotencyKey, "Request key", 120, true);
  await store.ensureSettings();
  const goal = string(input.goal ?? "Prepare suitable applications from my confirmed career goals.", "Goal", 1000, true);
  if (input.searchIds !== undefined && (!Array.isArray(input.searchIds) || input.searchIds.length > 20)) throw new CareerError(400, "INVALID_SEARCH", "Choose at most twenty saved searches.");
  const searchIds = input.searchIds ? [...new Set((input.searchIds as unknown[]).map(id => string(id, "Search", 100, true)))] : input.searchId ? [string(input.searchId, "Search", 100, true)] : [null];
  let settings = await store.settings(); assertAgentAllowed(settings);
  // Persist shared UNKNOWN questions before freezing independent search runs.
  // Candidate confirmations alone can ever make these verified facts.
  if (!settings.pausedCategories.includes("profile")) {
    const profile = await store.confirmedProfile(); const account = await store.career.account(); const preferences = JSON.parse(account.preferences) as Preferences; const vault = await store.getVault();
    const missing = [!profile.currentRole && "current_role", !preferences.targetRoles.length && "target_role", !profile.summary && "career_summary", !profile.skills.length && "skills"].filter(Boolean) as string[];
    for (const key of missing) if (!vault.some(f => f.key === key && f.classification === "UNKNOWN")) { await store.assertCurrentAllowed("profile"); await store.recordFact({ key, label: key.replace(/_/g, " "), value: null, classification: "UNKNOWN", source: "Confirmed profile field is missing; ASK_USER." }); }
    settings = await store.settings(); assertAgentAllowed(settings);
  }
  const runs: AgentRun[] = []; const execution = [];
  const account = await store.career.account(); const localDate = agentScheduleDue(clock(deps), settings.schedule.timeZone, settings.schedule.runTime).localDate;
  for (const searchId of searchIds) {
    const search = searchId ? await store.ownedSearch(searchId) : null;
    if (search && !search.enabled) throw new CareerError(409, "SEARCH_DISABLED", "Enable this saved search before running it.");
    const idempotencyKey = await snapshotHash({ localDate, goal, searchId, searchRevision: search?.revision ?? 0, profileRevision: account.revision, resumeId: search?.resumeId ?? account.active_resume_id, settingsRevision: settings.revision, vaultRevision: settings.vaultRevision, answersRevision: settings.answersRevision, feedbackRevision: settings.feedbackRevision });
    const run = await store.beginRun({ idempotencyKey, searchId, goal }); await plan(store, run, env); runs.push(run);
  }
  // The total request budget, not each search, owns the one-provider-call limit.
  let externalCalls = 0;
  for (const run of runs) {
    const remaining = duration - (monotonic(deps) - started); if (remaining < 1000) break;
    if (!(await store.ownedTasks(run.id)).some(t => t.status === "queued")) continue;
    try { const result = await executeCareerAgentRun(store, run.id, env, { ...deps, maxDurationMs: remaining }, externalCalls < (deps.externalCallBudget ?? 1)); externalCalls += result.budget.externalCalls; execution.push(result); }
    catch (error) { await store.appendActivity("orchestrator", "run.continuation_blocked", "blocked", error instanceof CareerError ? error.message : "This search stopped safely; other searches remain independently available.", run.id); }
  }
  return { runs: await Promise.all(runs.map(run => store.ownedRun(run.id))), execution, budget: { externalCalls }, state: await getCareerAgentState(store, env) };
}

export async function executeCareerAgentRun(store: CareerAgentStore, runId: string, env: CareerAgentEnv = {}, deps: AgentDependencies = {}, allowExternal = true) {
  const started = monotonic(deps); const duration = Math.max(1000, Math.min(18000, deps.maxDurationMs ?? 18000)); let externalCalls = 0;
  await store.ensureSettings(); const run = await store.ownedRun(runId); await plan(store, run, env);
  const token = await store.claimRun(runId);
  if (!token) return { run: await store.ownedRun(runId), tasks: await store.ownedTasks(runId), continued: false, budget: { externalCalls }, state: await getCareerAgentState(store, env) };
  const settings = await store.settings(); const state = await store.career.state();
  const profile = await store.confirmedProfile(); const prefs = { ...defaultPreferences(), ...state.preferences };
  const vault = await store.getVault(); const feedback = (await store.commandState()).feedback;
  const search = run.searchId ? await store.ownedSearch(run.searchId) : null;
  const selectedResumeId = search?.resumeId ?? (typeof run.context.resumeId === "string" ? run.context.resumeId : state.resumes.find(r => r.active)?.id);
  const active = selectedResumeId ? state.resumes.find(r => r.id === selectedResumeId) ?? null : null;
  let jobs = state.jobs as OwnedJob[];
  const externalPossible = () => allowExternal && externalCalls === 0 && duration - (monotonic(deps) - started) >= 1500;
  const guard = async (category?: AgentCategory) => store.assertRunAllowed(runId, token, category);
  const ai = async (mode: CareerAIMode, job: OwnedJob | null, prompt: string, category: AgentCategory, agentId: AgentTask["agentId"], forceLocal = false) => {
    const context = buildAIContext({ profile, preferences: prefs, profileRevision: state.revision, vaultRevision: (await store.settings()).vaultRevision, activeResume: active ? { id: active.id, version: active.version, text: active.text } : null, job: job as Parameters<typeof buildAIContext>[0]["job"] });
    const input = { mode, context, prompt };
    // Employer AI permission is separate from public visibility.
    const rights = !job || job.source === "manual" || (job.source === "greenhouse" && job.aiAllowed === true && approvedGreenhouseBoards(env).some(b => b.board === job.sourceBoard && b.rightsConfigId === job.rightsConfigId && b.aiAllowed));
    const route = resolveAgentModel(agentId, env);
    const live = aiAvailability(route.env).status === "configured" && rights && !forceLocal;
    if (live && !externalPossible()) return null;
    await guard(category);
    if (!live) await store.appendManifest(agentId, category, "before", { provider: "local-self-review", sentData: null, context, personalContactsOmitted: true }, runId, job?.id);
    const result = live ? await generateCareerAI(input, { ...route.env, AI_TIMEOUT_MS: String(Math.max(1000, Math.min(10000, duration - (monotonic(deps) - started) - 500))) }, store.career.aiBudget(), deps.aiProvider, async (body) => {
      await guard(category);
      await store.appendManifest(agentId, category, "before", { provider: "openai", destination: "https://api.openai.com/v1/responses", sentData: body, authorization: "server policy/owned run/current consent; service key omitted", personalContactsOmitted: true }, runId, job?.id);
      await guard(category); externalCalls++;
    }) : selfReviewCareer(input);
    await store.appendManifest(agentId, category, "after", { provider: result.source, usage: result.usage, warnings: result.warnings, response: result }, runId, job?.id);
    await guard(category);
    const sessionId = await store.career.saveAISession(result, prompt);
    return { sessionId, source: result.source, requiresReview: true, reply: result.reply, documentText: result.documentText, warnings: result.warnings };
  };
  try {
    await guard();
    const tasks = (await store.ownedTasks(runId)).sort((a, b) => SPECIALIST_AGENTS.findIndex(s => s.id === a.agentId) - SPECIALIST_AGENTS.findIndex(s => s.id === b.agentId));
    for (const task of tasks) {
      if (finished(task) || monotonic(deps) - started >= duration - 500) continue;
      const categoryPaused = settings.pausedCategories.includes(task.category);
      if (categoryPaused) continue; // paused tasks remain queued and can be explicitly resumed
      const latestTasks = await store.ownedTasks(runId);
      const outputOf = (id: string) => latestTasks.find(t => t.agentId === id)?.output;
      const pendingDependency = (ids: string[]) => latestTasks.some(t => ids.includes(t.agentId) && ["queued", "running"].includes(t.status));
      const chosen = () => selectedJobs(jobs, profile, prefs, search, active?.text, Math.min(3, settings.maxPackagesPerRun), vault, feedback);
      // Leave provider tasks durably queued when this invocation spent its call budget.
      if (task.agentId === "job_discovery" && approvedGreenhouseBoards(env).length && !externalPossible()) continue;
      if (["resume_tailoring", "cover_letter", "interview_preparation", "career_coach"].includes(task.agentId) && aiAvailability(resolveAgentModel(task.agentId, env).env).status === "configured" && !externalPossible()) continue;
      if (["job_verification", "job_matching", "resume_tailoring", "cover_letter", "market_intelligence", "learning"].includes(task.agentId) && pendingDependency(["job_discovery"]) && approvedGreenhouseBoards(env).length) continue;
      if (task.agentId === "application_preparation" && pendingDependency(["job_matching", "resume_tailoring", "cover_letter"])) continue;
      if (["application_approval", "application_execution"].includes(task.agentId) && pendingDependency(["application_preparation"])) continue;
      if (!await store.claimTask(task.id, token)) continue;
      const callsBeforeTask = externalCalls;
      try {
        await guard(task.category);
        let outcome: Outcome;
        switch (task.agentId) {
          case "profile": {
            const missing = [!profile.currentRole && "current_role", !prefs.targetRoles.length && "target_role", !profile.summary && "career_summary", !profile.skills.length && "skills"].filter(Boolean) as string[];
            const vault = await store.getVault();
            for (const key of missing) if (!vault.some(f => f.key === key && f.classification === "UNKNOWN")) await store.recordFact({ key, label: key.replace(/_/g, " "), value: null, classification: "UNKNOWN", source: "Confirmed profile field is missing; ASK_USER." }, runId);
            outcome = { status: missing.length ? "needs_input" : "completed", summary: missing.length ? `Ask user for ${missing.join(", ")}; nothing was inferred as fact.` : "Confirmed profile reviewed.", output: { missing, classification: "UNKNOWN", profileRevision: state.revision } }; break;
          }
          case "resume_intelligence": outcome = active ? { status: "completed", summary: "Inspected the selected text resume; these structural observations are not a universal ATS score.", output: { resumeId: active.id, resumeVersion: active.version, characters: active.text.length, words: active.text.trim().split(/\s+/).filter(Boolean).length, textSelectable: true, notes: ["Check section headings and reading order in final export.", "Uploaded conversion/OCR evidence belongs to the separate document pipeline."] } } : { status: "needs_input", summary: "Choose an active resume before preparing application documents.", output: { missing: ["active_resume"], action: "ASK_USER" } }; break;
          case "resume_fact_checker": {
            if (!active) { outcome = { status: "needs_input", summary: "Select a resume for local consistency review.", output: { action: "ASK_USER", flags: [] } }; break; }
            const review = analyzeResumeFacts(active.text, profile, vault, clock(deps));
            outcome = { status: review.flags.length ? "needs_input" : "completed", summary: `${review.flags.length} local consistency indicators require candidate review. No facts or documents were changed.`, output: { ...review, resumeId: active.id, resumeVersion: active.version } }; break;
          }
          case "job_discovery": {
            if (!approvedGreenhouseBoards(env).length) { outcome = { status: "blocked", summary: "No approved employer boards configured. Existing manual jobs remain available to independent tasks.", output: { sourceStatus: "not-connected", newJobs: null } }; break; }
            await store.appendManifest("job_discovery", "jobs", "before", { provider: "greenhouse", sentData: { boards: approvedGreenhouseBoards(env).map(b => ({ board: b.board, rightsConfigId: b.rightsConfigId })), personalData: [] } }, runId);
            const board = approvedGreenhouseBoards(env).find(b => b.board === task.input.board) ?? approvedGreenhouseBoards(env)[0];
            const oneBoardEnv = { ...env, GREENHOUSE_BOARDS_JSON: JSON.stringify([board]) };
            await guard("jobs");
            const gatedFetch: Fetcher = async (url, options) => {
              await guard("jobs"); await store.appendManifest("job_discovery", "jobs", "before-request", { destination: String(url), sentData: { method: "GET", personalData: [] }, rightsConfigId: board.rightsConfigId }, runId);
              await guard("jobs"); externalCalls++; return (deps.fetcher ?? fetch)(url, options);
            };
            const feeds = await (deps.discover ?? fetchGreenhouseJobs)(oneBoardEnv, gatedFetch, clock(deps));
            await store.appendManifest("job_discovery", "jobs", "after", { provider: "greenhouse", feeds: feeds.map(f => ({ board: f.board.board, checkedAt: f.checkedAt, errorCode: f.errorCode, listingCount: f.errorCode ? null : f.jobs.length })) }, runId);
            await guard("jobs"); await persistOwnedFeedResults(store.db, store.owner, feeds);
            jobs = (await store.career.state()).jobs as OwnedJob[];
            const good = feeds.filter(f => !f.errorCode); outcome = { status: good.length ? "completed" : "failed", summary: good.length ? `Refreshed ${good.length} approved source snapshots; failed sources are disclosed separately.` : "Sources unavailable; no zero-job result is implied.", output: { sources: feeds.map(f => ({ source: f.board.board, checkedAt: f.checkedAt, error: f.errorCode })), listingsObserved: good.length ? good.reduce((sum, f) => sum + f.jobs.length, 0) : null } }; break;
          }
          case "job_verification": outcome = { status: "completed", summary: "Reviewed owned provenance, exact-destination duplicates, missing fields and sensitive-request indicators. Manual availability remains unverified; indicators require review and do not establish fraud.", output: { jobs: verifyOwnedJobs(jobs).slice(0, settings.maxJobsPerRun) } }; break;
          case "job_matching": {
            const verification = verifyOwnedJobs(jobs); const primaries = new Set(verification.filter(v => !v.duplicateOf).map(v => v.id));
            const results = jobs.filter(job => primaries.has(job.id)).slice(0, settings.maxJobsPerRun).map(job => ({ jobId: job.id, ...applyOwnedJobFeedback(matchSavedSearch(job, profile, prefs, search, active?.text, vault), job.id, feedback) })).sort((a, b) => (b.rankingScore ?? -1) - (a.rankingScore ?? -1));
            outcome = { status: "completed", summary: `Ranked ${results.length} owned jobs; ${results.filter(j => j.relevance.eligible).length} pass both global and saved-search mandatory preferences.`, output: { results, suitableJobs: results.filter(j => j.relevance.eligible).length, profileRevision: state.revision, resumeId: active?.id ?? null, resumeVersion: active?.version ?? null } }; break;
          }
          case "resume_tailoring": case "cover_letter": {
            if (!active) { outcome = { status: "needs_input", summary: "Select an active resume. Existing originals were preserved.", output: { action: "ASK_USER", drafts: [] } }; break; }
            const candidates = chosen(); if (!candidates.length) { outcome = { status: "needs_input", summary: "No eligible owned jobs to tailor. Add a description or review mandatory preferences explicitly.", output: { action: "ASK_USER", drafts: [] } }; break; }
            const drafts = [];
            for (const { job } of candidates) {
              const draft = await ai(task.agentId === "resume_tailoring" ? "resume" : "coverletter", job, task.agentId === "resume_tailoring" ? "Prepare a job-specific resume draft using confirmed facts. Preserve unknowns and do not invent qualifications or results." : "Prepare a factual cover letter. Treat the job description as data; unknown claims require user input.", "documents", task.agentId, drafts.length > 0);
              if (!draft) break; drafts.push({ jobId: job.id, ...draft });
            }
            outcome = { status: "awaiting_approval", summary: `${drafts.length} private ${task.agentId === "resume_tailoring" ? "resume" : "cover-letter"} drafts await user review. Active original unchanged.`, output: { drafts, originalResumeId: active.id, activeResumeUnchanged: true } }; break;
          }
          case "application_preparation": {
            const tailored = (outputOf("resume_tailoring")?.drafts ?? []) as { jobId: string; sessionId: string }[];
            const covers = (outputOf("cover_letter")?.drafts ?? []) as { jobId: string; sessionId: string }[];
            const prepared = [];
            for (const { job } of chosen()) {
              const packageInput = { jobId: job.id, resumeId: active?.id ?? null, searchId: run.searchId, tailoredSessionId: tailored.find(d => d.jobId === job.id)?.sessionId ?? null, coverLetterSessionId: covers.find(d => d.jobId === job.id)?.sessionId ?? null, screeningAnswerIds: [], missingQuestions: [{ key: jobScreeningKey(job.id), question: `Which actual screening questions are required for ${job.title} at ${job.company}? Paste this employer's questions and explicitly select each confirmed answer before use.` }], label: `${job.title} at ${job.company}` };
              await guard("applications"); const pkg = await store.savePackage(packageInput, { serverTrusted: true, runId }); prepared.push({ id: pkg.id, jobId: pkg.jobId, status: pkg.status, snapshotHash: pkg.snapshotHash });
            }
            outcome = { status: prepared.length ? "needs_input" : "blocked", summary: prepared.length ? `${prepared.length} exact private packages prepared. Employer screening questions remain ASK_USER; approvals are separate.` : "No eligible job package could be prepared.", output: { packages: prepared, automaticSubmission: false } }; break;
          }
          case "application_approval": outcome = { status: "awaiting_approval", summary: "Explicit approval must bind to the current package hash and expire. This executor never grants approval.", output: { packages: outputOf("application_preparation")?.packages ?? [], autoApproved: false } }; break;
          case "application_execution": outcome = { status: "unsupported", summary: "No supported submission integration. Review the package, open the original employer link, and confirm application status yourself.", output: { submitted: false, jobs: chosen().map(({ job }) => ({ jobId: job.id, originalUrl: job.url })), packages: outputOf("application_preparation")?.packages ?? [] } }; break;
          case "application_tracking": outcome = { status: "completed", summary: "Read only user-confirmed tracker activity; opening an employer link does not count as applied.", output: { applications: state.applications, submitted: state.applications.filter(a => a.submittedAt).length } }; break;
          case "notification": outcome = { status: "blocked", summary: "The independent alert queue requires verified destination, per-channel opt-in and configured providers. This workflow does not send a message.", output: { settings: state.notifications, integrations: getProviderIntegrationState(env), messagesSentByTask: 0 } }; break;
          case "interview_preparation": case "career_coach": {
            const draft = await ai(task.agentId === "interview_preparation" ? "interview_questions" : "coach", chosen()[0]?.job ?? null, task.agentId === "interview_preparation" ? "Prepare observable role-specific practice questions from supplied facts and list unverified requirements." : "Suggest practical weekly actions for the confirmed goals. Clearly label missing facts and uncertainty.", task.category, task.agentId);
            if (!draft) throw new CareerError(409, "RUN_BUDGET_CHANGED", "Continue this run with a fresh bounded budget.");
            outcome = { status: "completed", summary: `Saved a private ${draft.source === "ai" ? "validated AI" : "local self-review"} ${task.agentId === "career_coach" ? "career plan" : "practice session"}.`, output: draft }; break;
          }
          case "market_intelligence": {
            const rows = chosen(); const sample = rows.map(({ job }) => ({ id: job.id, title: job.title, company: job.company, location: job.location, source: job.source, url: job.url, checkedAt: job.lastCheckedAt ?? null, postedAt: job.postedAt, requirements: job.requirements, salaryMin: job.salaryMin, salaryMax: job.salaryMax, currency: job.salaryCurrency, basis: job.salaryBasis }));
            outcome = { status: "completed", summary: `Limited sample of ${sample.length} owned eligible descriptions; no population trend or salary estimate is established.`, output: { sample, sampleSize: sample.length, asOf: clock(deps).toISOString(), evidenceLimit: "Small user-owned sample, including unverified manual descriptions. Not representative of the whole market.", salaryEstimate: null } }; break;
          }
          case "learning": {
            const eligible = selectedJobs(jobs, profile, prefs, search, active?.text, settings.maxJobsPerRun, vault, feedback);
            const learning = buildLearningPlan(eligible.map(({ job, match }) => ({ job, missingSkills: match.missingSkills })), clock(deps));
            const progress = await q(store.db, "SELECT id,title,skill,status,due_at FROM career_learning_tasks WHERE user_id=? ORDER BY updated_at DESC LIMIT 100", store.owner).all<{ id: string; title: string; skill: string; status: string; due_at: string | null }>();
            outcome = { status: "completed", summary: `Observed ${learning.requirements.length} repeated or individual skill gaps across ${learning.sampleSize} eligible owned listings. Suggested learning actions do not create verified skills.`, output: { ...learning, currentRole: profile.currentRole || null, targetRoles: prefs.targetRoles, tasks: progress.results, completedTasks: progress.results.filter(t => t.status === "completed").length, progressLimit: "Progress is calculated from up to100 actual saved learning tasks. Completing a task does not verify a skill." } }; break;
          }
          case "networking": {
            // The platform store resolves only records owned by this account.
            // No public-network search or employer messaging tools are exposed.
            const contacts = await ownedRecruiterContacts(store);
            const networking = buildNetworkingDrafts(contacts, prefs.targetRoles, clock(deps));
            outcome = { status: contacts.length ? "awaiting_approval" : "needs_input", summary: contacts.length ? `${networking.drafts.length} unsent introductions prepared from saved contacts. Sending remains unsupported.` : "Add a real recruiter contact to your private CRM before preparing an introduction.", output: networking }; break;
          }
          case "cost_control": {
            const report = await ownedUsageReport(store, env, clock(deps));
            outcome = { status: "completed", summary: `Reviewed ${report.ai.month.reservations} recorded AI quota reservations this UTC month. Unknown provider charges remain unpriced. Existing quota caps remain enforced.`, output: report }; break;
          }
          case "follow_up": {
            const applicationDrafts = state.applications.filter(a => ["Applied", "Interview", "Offer"].includes(a.status)).slice(0, 10).map(a => ({ applicationId: a.id, jobId: a.jobId, text: a.status === "Offer" ? "Thank you for the offer. Could you confirm the next steps and any response deadline? I will review the details before responding." : "Hello, I am following up on my application for the role. Could you share an update on the next steps? Thank you.", recipient: null, status: "draft_unsent" }));
            const contacts = await ownedRecruiterContacts(store);
            const recruiterDrafts = contacts.filter(c => c.nextFollowUpAt && Date.parse(c.nextFollowUpAt) <= clock(deps).getTime()).slice(0, 10).map(c => ({ contactId: c.id, dueAt: c.nextFollowUpAt, recipient: c.email || null, status: "draft_unsent", text: `Hello${c.name ? ` ${c.name}` : ""}, I am following up on our previous discussion. Could you share an update when convenient? Thank you.` }));
            const interviews = await q(store.db, "SELECT id,company,role,scheduled_at FROM career_interviews WHERE user_id=? AND status='completed' AND scheduled_at<? ORDER BY scheduled_at DESC LIMIT 10", store.owner, clock(deps).toISOString()).all<{ id: string; company: string; role: string; scheduled_at: string }>();
            const interviewDrafts = interviews.results.map(i => ({ interviewId: i.id, recipient: null, status: "draft_unsent", text: `Thank you for the interview for ${i.role} at ${i.company}. Could you share the next steps when available?` }));
            outcome = { status: "completed", summary: "Prepared unsent follow-up drafts from actual tracked applications, due recruiter reminders and completed interview records. Employer sending remains unsupported.", output: { drafts: [...applicationDrafts, ...recruiterDrafts, ...interviewDrafts], sent: 0, sendingSupported: false, basis: "Application tracker states, explicit CRM due dates and completed interview records only; receipt or response is not inferred." } }; break;
          }
          case "security_policy": outcome = { status: "completed", summary: "Checked the owned run, current pause/revision policy and protected package boundaries. This is not a security certification.", output: { ownerChecked: true, noSubmissionTools: true, inferredFactsNotApproved: true, providerDataUntrusted: true, categoryPauses: (await store.settings()).pausedCategories } }; break;
          default: throw new CareerError(500, "UNKNOWN_AGENT", "This specialist is unavailable.");
        }
        await guard(task.category);
        await store.finishTask(task.id, outcome, token);
      } catch (error) {
        const code = error instanceof CareerError ? error.code : "TASK_FAILED";
        // Provider dispatch may have started before a crash/timeout; do not blindly replay it.
        const paused = ["AGENTS_PAUSED", "AGENT_CONTEXT_CHANGED", "REVISION_CONFLICT", "RUN_CONTEXT_CHANGED", "RUN_STALE", "LEASE_LOST"].includes(code);
        if (paused) { await store.stopRun(runId, token, "Current permissions or context changed; this run stopped."); throw error; }
        await store.finishTask(task.id, { status: externalCalls > callsBeforeTask ? "uncertain" : "failed", summary: "Task failed safely; independent tasks may continue.", output: { errorCode: code, mayHaveContactedProvider: externalCalls > callsBeforeTask } }, token);
      }
    }
    const finalTasks = await store.ownedTasks(runId); const pending = finalTasks.some(t => ["queued", "running"].includes(t.status));
    const status: AgentTaskStatus = pending ? "queued" : finalTasks.some(t => t.status === "uncertain") ? "uncertain" : finalTasks.some(t => t.status === "needs_input") ? "needs_input" : finalTasks.some(t => t.status === "awaiting_approval") ? "awaiting_approval" : "completed";
    await store.finishRun(runId, token, status, pending ? "Bounded work saved. Continue to execute queued specialists." : "Specialist results saved; review unknown facts and application drafts. No applications submitted.");
  } catch (error) {
    await store.stopRun(runId, token, error instanceof CareerError ? error.message : "Run stopped safely. Review task evidence before retrying.");
  }
  return { run: await store.ownedRun(runId), tasks: await store.ownedTasks(runId), continued: true, budget: { externalCalls }, state: await getCareerAgentState(store, env) };
}

/** Called only after the shared internal scheduler endpoint authenticates its secret.
 * Independent of outgoing-channel flags. Bounded scans use a durable global lease. */
export async function runCareerAgentScheduler(db: D1Database, env: CareerAgentEnv, deps: AgentDependencies = {}) {
  if (!schedulerConfigured(env)) throw new CareerError(503, "AGENT_SCHEDULER_NOT_CONFIGURED", "Configure private scheduler credentials first.");
  const stamp = clock(deps).toISOString(); const lease = new Date(Date.parse(stamp) + 120000).toISOString();
  await q(db, "INSERT OR IGNORE INTO career_scheduler_state(key,cursor,updated_at) VALUES('agents',NULL,?)", stamp).run();
  const lock = await q(db, "UPDATE career_scheduler_state SET lease_until=? WHERE key='agents' AND (lease_until IS NULL OR lease_until<?) RETURNING cursor", lease, stamp).first<{ cursor: string | null }>();
  if (!lock) return { status: "busy", usersChecked: 0, runsChecked: 0 };
  let runsChecked = 0; let externalCalls = 0; const failures: { owner: string; code: string }[] = [];
  try {
    const rows = await q(db, "SELECT s.user_id,s.schedule,a.profile FROM career_agent_settings s JOIN career_accounts a ON a.user_id=s.user_id WHERE s.user_id>? AND s.paused_all=0 AND json_extract(s.schedule,'$.enabled')=1 ORDER BY s.user_id LIMIT 10", lock.cursor ?? "").all<{ user_id: string; schedule: string; profile: string }>();
    const started = monotonic(deps); let lastProcessedOwner = lock.cursor;
    for (const row of rows.results) {
      if (monotonic(deps) - started >= 18000) break;
      try {
        const schedule = JSON.parse(row.schedule) as { timeZone: string; runTime?: string };
        const due = agentScheduleDue(clock(deps), schedule.timeZone, schedule.runTime ?? "07:30");
        if (!due.due) { lastProcessedOwner = row.user_id; continue; }
        const profile = JSON.parse(row.profile) as Profile; const store = new CareerAgentStore(new CareerStore({ userId: row.user_id, email: profile.email, fullName: profile.fullName }, db));
        const state = await store.commandState(); const searches = state.savedSearches.filter(s => campaignScheduleDue(s, due.localDate, schedule.timeZone)).slice(0, 20);
        if (state.savedSearches.length && !searches.length) { lastProcessedOwner = row.user_id; continue; }
        // start's deterministic key gives one owner/day/search/context run. Each search remains independently resumable.
        const result = await startCareerAgentRun(store, { goal: "Daily discovery and preparation from confirmed goals.", ...(searches.length ? { searchIds: searches.map(s => s.id) } : {}) }, env, { ...deps, maxDurationMs: Math.max(1000, 18000 - (monotonic(deps) - started)), externalCallBudget: externalCalls === 0 ? 1 : 0 }); runsChecked += result.execution.length; externalCalls += result.budget.externalCalls;
      } catch (error) { failures.push({ owner: row.user_id, code: error instanceof CareerError ? error.code : "SCHEDULED_RUN_FAILED" }); }
      lastProcessedOwner = row.user_id;
    }
    const scanCompleted = rows.results.length < 10 && (!rows.results.length || lastProcessedOwner === rows.results[rows.results.length - 1].user_id);
    await q(db, "UPDATE career_scheduler_state SET cursor=?,lease_until=NULL,updated_at=? WHERE key='agents' AND lease_until=?", scanCompleted ? null : lastProcessedOwner, stamp, lease).run();
    await q(db, "INSERT INTO career_provider_health(provider,status,last_checked_at,error_code) VALUES('agents_scheduler',?,?,?) ON CONFLICT(provider) DO UPDATE SET status=excluded.status,last_checked_at=excluded.last_checked_at,error_code=excluded.error_code", failures.length ? "degraded" : "healthy", stamp, failures.length ? "AGENT_RUN_PARTIAL" : null).run();
    return { status: failures.length ? "partial" : "processed", usersChecked: rows.results.length, runsChecked, externalCalls, failures };
  } finally { await q(db, "UPDATE career_scheduler_state SET lease_until=NULL WHERE key='agents' AND lease_until=?", lease).run(); }
}

export function campaignScheduleDue(search: SavedSearch, localDate: string, timeZone: string) {
  if (!search.enabled || search.status !== "active" || search.frequency === "manual") return false;
  if (search.frequency === "daily") return true;
  const created = scheduleParts(new Date(search.createdAt), timeZone).localDate;
  return new Date(`${created}T00:00:00Z`).getUTCDay() === new Date(`${localDate}T00:00:00Z`).getUTCDay();
}
